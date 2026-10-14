-- PENTE FINO (anotações do cliente):
-- * horário de trabalho fixo na ficha (entrada, saída, intervalo, dias de folga) → sugere a escala e a jornada prevista;
-- * gerar a escala de um período a partir do horário fixo (sem sobrescrever dias já preenchidos);
-- * "faturar para empresa" no café com o nome da empresa;
-- * desconto gerado a partir de ocorrência aprovada (falta/atraso), uma vez só (pela origem);
-- * valor da passagem por dia (relatório para a contabilidade).

alter table public.colaboradores
  add column horario_entrada time,
  add column horario_saida time,
  add column intervalo_minutos int not null default 60 check (intervalo_minutos between 0 and 600),
  add column dias_folga int[] not null default '{}' check (dias_folga <@ array[1, 2, 3, 4, 5, 6, 7]);

comment on column public.colaboradores.dias_folga is 'Dias de folga fixos: 1 = segunda ... 7 = domingo.';

-- Nomes + horário para quem monta a escala (sem abrir a ficha completa).
drop function public.pessoas_escala();
create function public.pessoas_escala()
returns table (
  id uuid, nome text, apelido text, funcao text, vinculo public.vinculo_colaborador, situacao public.situacao_colaborador,
  horario_entrada time, horario_saida time, intervalo_minutos int, dias_folga int[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.nome, c.apelido, c.funcao, c.vinculo, c.situacao, c.horario_entrada, c.horario_saida, c.intervalo_minutos, c.dias_folga
  from public.colaboradores c
  where privado.pode('escalas', 'ver') or privado.pode('ponto', 'ver') or privado.pode('colaboradores', 'ver')
     or privado.pode('caixa', 'ver')
  order by c.nome;
$$;
revoke execute on function public.pessoas_escala() from public, anon;
grant execute on function public.pessoas_escala() to authenticated;

-- Preenche a escala do período com o horário fixo de cada pessoa (ou de uma só). Não mexe em dias já preenchidos.
create function public.gerar_escala_padrao(p_inicio date, p_fim date, p_colaborador uuid default null)
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
  insert into public.escalas (colaborador_id, data, tipo, hora_inicio, hora_fim, intervalo_minutos)
  select p.id, d::date,
         case when extract(isodow from d)::int = any (p.dias_folga) then 'folga'::public.tipo_escala else 'turno'::public.tipo_escala end,
         case when extract(isodow from d)::int = any (p.dias_folga) then null else p.horario_entrada end,
         case when extract(isodow from d)::int = any (p.dias_folga) then null else p.horario_saida end,
         case when extract(isodow from d)::int = any (p.dias_folga) then 0 else p.intervalo_minutos end
  from public.pessoas_escala() p
  cross join generate_series(p_inicio, p_fim, interval '1 day') d
  where p.situacao = 'ativo'
    and p.horario_entrada is not null and p.horario_saida is not null
    and (p_colaborador is null or p.id = p_colaborador)
  on conflict (colaborador_id, data) do nothing;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;
revoke execute on function public.gerar_escala_padrao(date, date, uuid) from public, anon;
grant execute on function public.gerar_escala_padrao(date, date, uuid) to authenticated;

-- Café: faturar para empresa com o nome do cliente.
alter table public.cafe_ajustes add column cliente_id uuid references public.clientes (id);
alter table public.cafe_ajustes add constraint faturar_com_empresa
  check (motivo <> 'faturar_empresa' or cliente_id is not null or length(trim(coalesce(descricao, ''))) > 0) not valid;

insert into public.configuracoes (chave, valor, descricao) values
  ('passagem_valor_dia', '0', 'Valor da passagem por dia trabalhado (relatório de horas para a contabilidade).')
on conflict (chave) do nothing;
