-- EXCLUIR registros criados por engano (pedido do dono em 15/10/2026).
-- Nova ação de permissão "excluir": o Administrador sempre tem; os demais papéis só se o admin liberar na tela
-- Permissões. Tudo o que é excluído fica guardado no Histórico (gatilho de auditoria grava a cópia "apagou").
-- Períodos fechados (quinzena enviada, folha-ponto fechada) continuam protegidos: reabra antes de excluir.

alter table public.permissoes drop constraint permissoes_acao_check;
alter table public.permissoes add constraint permissoes_acao_check
  check (acao in ('ver', 'criar', 'editar', 'aprovar', 'cancelar', 'exportar', 'excluir'));

-------------------------------------------------------------------------------
-- Regras de exclusão por tabela
-------------------------------------------------------------------------------
create policy "excluir colaboradores" on public.colaboradores for delete to authenticated
  using ((select privado.pode('colaboradores', 'excluir')));
create policy "excluir dados bancarios" on public.colaboradores_bancarios for delete to authenticated
  using ((select privado.pode('dados_bancarios', 'excluir')) or (select privado.pode('colaboradores', 'excluir')));
create policy "excluir ocorrencias" on public.ocorrencias for delete to authenticated
  using ((select privado.pode('ocorrencias', 'excluir')));
create policy "excluir lancamentos do colaborador" on public.lancamentos_colaborador for delete to authenticated
  using ((select privado.pode('financeiro', 'excluir')));
create policy "excluir diarias" on public.diarias for delete to authenticated
  using ((select privado.pode('colaboradores', 'excluir')));

drop policy "apagar escalas" on public.escalas;
create policy "apagar escalas" on public.escalas for delete to authenticated
  using ((select privado.pode('escalas', 'editar')) or (select privado.pode('escalas', 'excluir')));
create policy "excluir ponto" on public.registros_ponto for delete to authenticated
  using ((select privado.pode('ponto', 'excluir')));
create policy "excluir fechamentos de ponto" on public.fechamentos_ponto for delete to authenticated
  using ((select privado.pode('ponto', 'excluir')));

create policy "excluir dia do cafe" on public.cafe_dias for delete to authenticated
  using ((select privado.pode('cafes', 'excluir')));
create policy "excluir ajuste do cafe" on public.cafe_ajustes for delete to authenticated
  using ((select privado.pode('cafes', 'excluir')));
create policy "excluir bordero" on public.consumos_quarto for delete to authenticated
  using ((select privado.pode('cafes', 'excluir')));
create policy "excluir mensalistas" on public.cafe_mensalistas for delete to authenticated
  using ((select privado.pode('cafes', 'excluir')));
create policy "excluir venda de cafe" on public.cafe_vendas for delete to authenticated
  using ((select privado.pode('cafes', 'excluir')));
create policy "excluir quinzena" on public.quinzenas_hotel for delete to authenticated
  using ((select privado.pode('cafes', 'excluir')));

create policy "excluir tarefas da rotina" on public.rotina_tarefas for delete to authenticated
  using ((select privado.pode('painel', 'excluir')));

-------------------------------------------------------------------------------
-- Travas de período também valem para exclusão
-------------------------------------------------------------------------------
create or replace function public.bloquear_quinzena_fechada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.quinzenas_hotel q
    where q.situacao <> 'reaberta'
      and ((tg_op <> 'DELETE' and new.data between q.inicio and q.fim)
        or (tg_op <> 'INSERT' and old.data between q.inicio and q.fim))
  ) then
    raise exception 'Esta quinzena já foi enviada ao hotel. Reabra a quinzena para alterar ou excluir.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger cafe_dias_quinzena_excluir before delete on public.cafe_dias
  for each row execute function public.bloquear_quinzena_fechada();
create trigger cafe_ajustes_quinzena_excluir before delete on public.cafe_ajustes
  for each row execute function public.bloquear_quinzena_fechada();
create trigger consumos_quarto_quinzena_excluir before delete on public.consumos_quarto
  for each row execute function public.bloquear_quinzena_fechada();

create or replace function public.bloquear_ponto_mes_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.fechamentos_ponto f
    where f.situacao = 'fechado'
      and ((tg_op <> 'DELETE' and f.colaborador_id = new.colaborador_id and f.competencia = to_char(new.data, 'YYYY-MM'))
        or (tg_op <> 'INSERT' and f.colaborador_id = old.colaborador_id and f.competencia = to_char(old.data, 'YYYY-MM')))
  ) then
    raise exception 'A folha-ponto deste mês está fechada. Peça para reabrir antes de alterar ou excluir.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger registros_ponto_mes_fechado_excluir before delete on public.registros_ponto
  for each row execute function public.bloquear_ponto_mes_fechado();

revoke execute on function public.bloquear_quinzena_fechada(), public.bloquear_ponto_mes_fechado() from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Excluir colaborador criado por engano, junto com o que foi lançado para ele.
-- Roda com as permissões de quem chama: precisa poder excluir em cada área afetada.
-------------------------------------------------------------------------------
create function public.contar_registros_colaborador(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'escalas', (select count(*) from public.escalas where colaborador_id = p_id),
    'ponto', (select count(*) from public.registros_ponto where colaborador_id = p_id),
    'fechamentos', (select count(*) from public.fechamentos_ponto where colaborador_id = p_id),
    'ocorrencias', (select count(*) from public.ocorrencias where colaborador_id = p_id),
    'financeiro', (select count(*) from public.lancamentos_colaborador where colaborador_id = p_id),
    'diarias', (select count(*) from public.diarias where colaborador_id = p_id),
    'bancarios', (select count(*) from public.colaboradores_bancarios where colaborador_id = p_id)
  );
$$;

create function public.excluir_colaborador(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not privado.pode('colaboradores', 'excluir') then
    raise exception 'Você não tem permissão para excluir colaboradores.';
  end if;
  delete from public.escalas where colaborador_id = p_id;
  delete from public.registros_ponto where colaborador_id = p_id;
  delete from public.fechamentos_ponto where colaborador_id = p_id;
  delete from public.ocorrencias where colaborador_id = p_id;
  delete from public.lancamentos_colaborador where colaborador_id = p_id;
  delete from public.diarias where colaborador_id = p_id;
  delete from public.colaboradores_bancarios where colaborador_id = p_id;
  delete from public.colaboradores where id = p_id;
  if not found then
    raise exception 'Colaborador não encontrado ou sem permissão para excluir.';
  end if;
end;
$$;

revoke execute on function public.contar_registros_colaborador(uuid), public.excluir_colaborador(uuid) from public, anon;
grant execute on function public.contar_registros_colaborador(uuid), public.excluir_colaborador(uuid) to authenticated;
