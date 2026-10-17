-- Turno do colaborador (Manhã/Tarde/Noite) e regime 12x36 (dia sim, dia não) para preencher a escala rápido.

alter table public.colaboradores
  add column turno text,
  add column regime text not null default 'semanal' check (regime in ('semanal', '12x36')),
  add column escala_referencia date; -- 12x36: um dia em que a pessoa trabalha (os outros alternam a partir dele)

alter table public.colaboradores add constraint regime_12x36_com_referencia
  check (regime <> '12x36' or escala_referencia is not null);

comment on column public.colaboradores.regime is 'semanal = folgas fixas (dias_folga); 12x36 = trabalha um dia e folga o outro a partir de escala_referencia.';

-- Nomes + horário/turno/regime para quem monta a escala (sem abrir a ficha completa).
drop function public.pessoas_escala();
create function public.pessoas_escala()
returns table (
  id uuid, nome text, apelido text, funcao text, vinculo public.vinculo_colaborador, situacao public.situacao_colaborador,
  horario_entrada time, horario_saida time, intervalo_minutos int, dias_folga int[],
  turno text, regime text, escala_referencia date
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.nome, c.apelido, c.funcao, c.vinculo, c.situacao, c.horario_entrada, c.horario_saida, c.intervalo_minutos, c.dias_folga,
         c.turno, c.regime, c.escala_referencia
  from public.colaboradores c
  where privado.pode('escalas', 'ver') or privado.pode('ponto', 'ver') or privado.pode('colaboradores', 'ver')
     or privado.pode('caixa', 'ver')
  order by c.nome;
$$;
revoke execute on function public.pessoas_escala() from public, anon;
grant execute on function public.pessoas_escala() to authenticated;

-- Preencher pelo horário fixo: agora entende 12x36 e grava o turno da pessoa.
create or replace function public.gerar_escala_padrao(p_inicio date, p_fim date, p_colaborador uuid default null)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_qtd int;
begin
  if not privado.pode('escalas', 'criar') then
    raise exception 'Você não tem permissão para criar escalas.';
  end if;
  if p_fim < p_inicio or p_fim - p_inicio > 62 then
    raise exception 'Escolha um período de até 2 meses.';
  end if;
  insert into public.escalas (colaborador_id, data, tipo, turno, hora_inicio, hora_fim, intervalo_minutos)
  select x.id, x.dia,
         case when x.folga then 'folga'::public.tipo_escala else 'turno'::public.tipo_escala end,
         case when x.folga then null else x.turno end,
         case when x.folga then null else x.horario_entrada end,
         case when x.folga then null else x.horario_saida end,
         case when x.folga then 0 else x.intervalo_minutos end
  from (
    select p.*, d::date as dia,
           case when p.regime = '12x36' then (d::date - p.escala_referencia) % 2 <> 0
                else extract(isodow from d)::int = any (p.dias_folga) end as folga
    from public.pessoas_escala() p
    cross join generate_series(p_inicio, p_fim, interval '1 day') d
    where p.situacao = 'ativo'
      and p.horario_entrada is not null and p.horario_saida is not null
      and (p_colaborador is null or p.id = p_colaborador)
  ) x
  on conflict (colaborador_id, data) do nothing;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;
