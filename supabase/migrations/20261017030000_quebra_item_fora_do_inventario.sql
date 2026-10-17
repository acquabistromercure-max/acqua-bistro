-- Quebra/perda de item que NÃO está no inventário ("Outro"): fica registrada (histórico e ocorrência do colaborador),
-- mas não desconta nada do estoque.

alter table public.inventario_movimentos alter column item_id drop not null;
alter table public.inventario_movimentos add column item_descricao text;
alter table public.inventario_movimentos add constraint item_ou_descricao
  check (item_id is not null or length(trim(coalesce(item_descricao, ''))) > 0);
-- Item fora do inventário só em quebra/perda (entradas, saídas e ajustes sempre têm item).
alter table public.inventario_movimentos add constraint fora_do_inventario_so_perda
  check (item_id is not null or tipo in ('quebra', 'perda', 'furto', 'descarte'));

drop function public.registrar_quebra(uuid, numeric, text, date, text, uuid, text);
create function public.registrar_quebra(
  p_item uuid,
  p_quantidade numeric,
  p_tipo text,
  p_data date,
  p_responsavel_tipo text,
  p_colaborador uuid,
  p_descricao text,
  p_item_descricao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventario_itens;
  v_nome text;
  v_unidade text;
  v_ocorrencia uuid;
  v_id uuid;
  v_rotulo text := case p_tipo when 'quebra' then 'Quebra' when 'perda' then 'Perda' when 'furto' then 'Furto/sumiço' else 'Descarte' end;
begin
  if not privado.pode('inventario', 'aprovar') then
    raise exception 'Só gerente ou administrador registra quebras e perdas.';
  end if;
  if p_tipo not in ('quebra', 'perda', 'furto', 'descarte') then raise exception 'Tipo inválido.'; end if;
  if coalesce(p_quantidade, 0) <= 0 then raise exception 'Informe a quantidade.'; end if;
  if length(trim(coalesce(p_descricao, ''))) = 0 then raise exception 'Descreva o que aconteceu.'; end if;
  if p_item is not null then
    select * into v_item from public.inventario_itens where id = p_item;
    if v_item.id is null then raise exception 'Item não encontrado.'; end if;
    v_nome := v_item.nome;
    v_unidade := v_item.unidade;
  else
    if length(trim(coalesce(p_item_descricao, ''))) = 0 then raise exception 'Informe qual foi o item.'; end if;
    v_nome := trim(p_item_descricao);
    v_unidade := 'un';
  end if;
  if p_responsavel_tipo = 'colaborador' then
    if p_colaborador is null then raise exception 'Escolha o colaborador.'; end if;
    insert into public.ocorrencias (colaborador_id, tipo, data, descricao, situacao, aprovado_por, aprovado_em, criado_por)
    values (p_colaborador, 'quebra', p_data,
            v_rotulo || ' de ' || trim(to_char(p_quantidade, 'FM999999990.##')) || ' ' || v_unidade || ' de ' || v_nome
              || case when p_item is null then ' (fora do inventário)' else ' (inventário)' end || ': ' || trim(p_descricao),
            'aprovada', auth.uid(), now(), auth.uid())
    returning id into v_ocorrencia;
  end if;
  insert into public.inventario_movimentos
    (item_id, item_descricao, data, tipo, quantidade, motivo, responsavel_tipo, colaborador_id, ocorrencia_id, aprovado_por, aprovado_em)
  values (p_item, case when p_item is null then trim(p_item_descricao) end, p_data, p_tipo, -p_quantidade, trim(p_descricao),
          p_responsavel_tipo, case when p_responsavel_tipo = 'colaborador' then p_colaborador end, v_ocorrencia, auth.uid(), now())
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.registrar_quebra(uuid, numeric, text, date, text, uuid, text, text) from public, anon;
grant execute on function public.registrar_quebra(uuid, numeric, text, date, text, uuid, text, text) to authenticated;
