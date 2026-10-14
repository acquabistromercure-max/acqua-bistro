-- ESCALAS E PONTO: escala por dia (turno, folga, férias, afastamento, ausência), marcações de ponto com
-- aprovação, e fechamento da folha-ponto por competência (mês). Regras de cálculo ficam em "configuracoes".

-------------------------------------------------------------------------------
-- Escala: um registro por pessoa por dia (o planejado).
-------------------------------------------------------------------------------
create type public.tipo_escala as enum ('turno', 'folga', 'ferias', 'afastamento', 'ausencia');

create table public.escalas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id),
  data date not null,
  tipo public.tipo_escala not null default 'turno',
  turno text,
  hora_inicio time,
  hora_fim time,
  intervalo_minutos int not null default 0 check (intervalo_minutos between 0 and 600),
  observacao text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (colaborador_id, data),
  constraint turno_com_horario check (tipo <> 'turno' or (hora_inicio is not null and hora_fim is not null))
);

create index escalas_data on public.escalas (data);

alter table public.escalas enable row level security;

create policy "ver escalas" on public.escalas for select to authenticated
  using ((select privado.pode('escalas', 'ver')));
create policy "criar escalas" on public.escalas for insert to authenticated
  with check ((select privado.pode('escalas', 'criar')));
create policy "editar escalas" on public.escalas for update to authenticated
  using ((select privado.pode('escalas', 'editar'))) with check ((select privado.pode('escalas', 'editar')));
-- Escala é planejamento: tirar um dia da escala é permitido a quem edita (fica no histórico/auditoria).
create policy "apagar escalas" on public.escalas for delete to authenticated
  using ((select privado.pode('escalas', 'editar')));

create trigger escalas_atualizado_em before update on public.escalas
  for each row execute function public.tocar_atualizado_em();
create trigger escalas_auditoria after insert or update or delete on public.escalas
  for each row execute function public.registrar_auditoria();

-- Nomes das pessoas para montar a escala. Quem só vê escalas (ex.: operador) não tem acesso à ficha
-- completa dos colaboradores, então esta função devolve apenas o necessário.
create function public.pessoas_escala()
returns table (id uuid, nome text, apelido text, funcao text, vinculo public.vinculo_colaborador, situacao public.situacao_colaborador)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.nome, c.apelido, c.funcao, c.vinculo, c.situacao
  from public.colaboradores c
  where privado.pode('escalas', 'ver') or privado.pode('ponto', 'ver') or privado.pode('colaboradores', 'ver')
  order by c.nome;
$$;

revoke execute on function public.pessoas_escala() from public, anon;
grant execute on function public.pessoas_escala() to authenticated;

-- Copia a escala de um período para outro (ex.: repetir a semana passada). Não sobrescreve dias já preenchidos.
-- Roda com as permissões de quem chama (RLS vale normalmente).
create function public.copiar_escala(p_origem date, p_destino date, p_dias int default 7, p_colaborador uuid default null)
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
  if p_dias < 1 or p_dias > 62 then
    raise exception 'Escolha entre 1 e 62 dias para copiar.';
  end if;
  if p_origem = p_destino then
    raise exception 'O período de destino precisa ser diferente do de origem.';
  end if;
  -- Desligados não são copiados. A situação vem de pessoas_escala() porque quem monta a escala
  -- pode não ter acesso à ficha completa dos colaboradores.
  insert into public.escalas (colaborador_id, data, tipo, turno, hora_inicio, hora_fim, intervalo_minutos, observacao)
  select e.colaborador_id, e.data + (p_destino - p_origem), e.tipo, e.turno, e.hora_inicio, e.hora_fim, e.intervalo_minutos, e.observacao
  from public.escalas e
  join public.pessoas_escala() c on c.id = e.colaborador_id
  where e.data between p_origem and p_origem + (p_dias - 1)
    and c.situacao <> 'desligado'
    and (p_colaborador is null or e.colaborador_id = p_colaborador)
  on conflict (colaborador_id, data) do nothing;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- Troca de escala entre duas pessoas: cada uma fica com o dia planejado da outra. Exige motivo.
create function public.trocar_escala(p_a uuid, p_b uuid, p_motivo text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a public.escalas;
  b public.escalas;
  v_nota text;
begin
  if length(trim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Informe o motivo da troca.';
  end if;
  select * into a from public.escalas where id = p_a;
  select * into b from public.escalas where id = p_b;
  if a.id is null or b.id is null then
    raise exception 'Escala não encontrada.';
  end if;
  if a.colaborador_id = b.colaborador_id then
    raise exception 'Escolha outra pessoa para a troca.';
  end if;
  v_nota := 'Troca: ' || trim(p_motivo);
  update public.escalas set tipo = b.tipo, turno = b.turno, hora_inicio = b.hora_inicio, hora_fim = b.hora_fim,
    intervalo_minutos = b.intervalo_minutos, observacao = v_nota
  where id = a.id;
  update public.escalas set tipo = a.tipo, turno = a.turno, hora_inicio = a.hora_inicio, hora_fim = a.hora_fim,
    intervalo_minutos = a.intervalo_minutos, observacao = v_nota
  where id = b.id;
  if not found then
    raise exception 'Você não tem permissão para trocar escalas.';
  end if;
end;
$$;

revoke execute on function public.copiar_escala(date, date, int, uuid), public.trocar_escala(uuid, uuid, text) from public, anon;
grant execute on function public.copiar_escala(date, date, int, uuid), public.trocar_escala(uuid, uuid, text) to authenticated;

-------------------------------------------------------------------------------
-- Ponto: marcações do dia (entrada, intervalo, saída). Registro → aprovação. Não é ponto eletrônico oficial.
-------------------------------------------------------------------------------
create table public.registros_ponto (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id),
  data date not null,
  entrada time not null,
  saida_intervalo time,
  volta_intervalo time,
  saida time,
  justificativa text,
  situacao public.situacao_registro not null default 'registrada',
  aprovado_por uuid references public.perfis (id),
  aprovado_em timestamptz,
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint intervalo_completo check ((saida_intervalo is null) = (volta_intervalo is null)),
  constraint cancelamento_com_motivo check (situacao <> 'cancelada' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

-- Uma marcação válida por pessoa por dia (canceladas ficam no histórico).
create unique index registros_ponto_um_por_dia on public.registros_ponto (colaborador_id, data) where situacao <> 'cancelada';
create index registros_ponto_data on public.registros_ponto (data);

alter table public.registros_ponto enable row level security;

create policy "ver ponto" on public.registros_ponto for select to authenticated
  using ((select privado.pode('ponto', 'ver')));
create policy "criar ponto" on public.registros_ponto for insert to authenticated
  with check ((select privado.pode('ponto', 'criar')) and situacao = 'registrada');
create policy "alterar ponto" on public.registros_ponto for update to authenticated
  using (
    (select privado.pode('ponto', 'editar')) or (select privado.pode('ponto', 'aprovar'))
    or (select privado.pode('ponto', 'cancelar'))
  );

-- Se alguém muda os horários de uma marcação aprovada, ela volta para "registrada" e precisa de nova aprovação.
create function public.ponto_reabrir_se_editado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'aprovada' and new.situacao = 'aprovada'
     and (new.entrada, new.saida_intervalo, new.volta_intervalo, new.saida, new.data, new.colaborador_id)
         is distinct from (old.entrada, old.saida_intervalo, old.volta_intervalo, old.saida, old.data, old.colaborador_id) then
    new.situacao := 'registrada';
    new.aprovado_por := null;
    new.aprovado_em := null;
  end if;
  return new;
end;
$$;

-- Os gatilhos "before" rodam em ordem alfabética: reabrir → situacao.
create trigger registros_ponto_reabrir before update on public.registros_ponto
  for each row execute function public.ponto_reabrir_se_editado();
create trigger registros_ponto_situacao before update on public.registros_ponto
  for each row execute function public.controlar_situacao('ponto');
create trigger registros_ponto_auditoria after insert or update or delete on public.registros_ponto
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Fechamento da folha-ponto por competência (AAAA-MM). Mês fechado não aceita mudanças no ponto.
-------------------------------------------------------------------------------
create table public.fechamentos_ponto (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id),
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  situacao text not null default 'fechado' check (situacao in ('fechado', 'reaberto')),
  resumo jsonb not null default '{}'::jsonb,
  fechado_por uuid default auth.uid() references public.perfis (id),
  fechado_em timestamptz not null default now(),
  reaberto_por uuid references public.perfis (id),
  reaberto_em timestamptz,
  motivo_reabertura text,
  constraint reabertura_com_motivo check (situacao <> 'reaberto' or length(trim(coalesce(motivo_reabertura, ''))) > 0)
);

create unique index fechamentos_ponto_um_aberto on public.fechamentos_ponto (colaborador_id, competencia) where situacao = 'fechado';

alter table public.fechamentos_ponto enable row level security;

create policy "ver fechamentos de ponto" on public.fechamentos_ponto for select to authenticated
  using ((select privado.pode('ponto', 'ver')));
create policy "fechar folha-ponto" on public.fechamentos_ponto for insert to authenticated
  with check ((select privado.pode('ponto', 'aprovar')) and situacao = 'fechado');
create policy "reabrir folha-ponto" on public.fechamentos_ponto for update to authenticated
  using ((select privado.pode('ponto', 'aprovar'))) with check ((select privado.pode('ponto', 'aprovar')));

-- Ao fechar: não pode haver marcação pendente de aprovação no mês. Ao reabrir: carimba quem e quando;
-- fora isso, um fechamento não muda (o resumo guardado é o retrato do mês).
create function public.controlar_fechamento_ponto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.registros_ponto r
      where r.colaborador_id = new.colaborador_id and r.situacao = 'registrada'
        and to_char(r.data, 'YYYY-MM') = new.competencia
    ) then
      raise exception 'Há marcações de ponto pendentes de aprovação neste mês. Aprove ou cancele antes de fechar.';
    end if;
    new.fechado_por := auth.uid();
    new.fechado_em := now();
    return new;
  end if;
  if old.situacao = 'reaberto' then
    raise exception 'Este fechamento já foi reaberto. Para fechar de novo, faça um novo fechamento.';
  end if;
  if new.situacao <> 'reaberto' or new.resumo is distinct from old.resumo
     or new.colaborador_id <> old.colaborador_id or new.competencia <> old.competencia then
    raise exception 'Um fechamento só pode ser reaberto, não alterado.';
  end if;
  new.reaberto_por := auth.uid();
  new.reaberto_em := now();
  return new;
end;
$$;

create trigger fechamentos_ponto_controle before insert or update on public.fechamentos_ponto
  for each row execute function public.controlar_fechamento_ponto();
create trigger fechamentos_ponto_auditoria after insert or update or delete on public.fechamentos_ponto
  for each row execute function public.registrar_auditoria();

-- Bloqueia marcações em mês fechado.
create function public.bloquear_ponto_mes_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.fechamentos_ponto f
    where f.situacao = 'fechado'
      and ((f.colaborador_id = new.colaborador_id and f.competencia = to_char(new.data, 'YYYY-MM'))
        or (tg_op = 'UPDATE' and f.colaborador_id = old.colaborador_id and f.competencia = to_char(old.data, 'YYYY-MM')))
  ) then
    raise exception 'A folha-ponto deste mês está fechada. Peça para reabrir antes de alterar.';
  end if;
  return new;
end;
$$;

create trigger registros_ponto_mes_fechado before insert or update on public.registros_ponto
  for each row execute function public.bloquear_ponto_mes_fechado();

revoke execute on function public.controlar_fechamento_ponto(), public.bloquear_ponto_mes_fechado(), public.ponto_reabrir_se_editado()
  from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Regras de cálculo (a validar com RH/contabilidade) e permissões novas
-------------------------------------------------------------------------------
insert into public.configuracoes (chave, valor, descricao) values
  ('ponto_tolerancia_minutos', '10',
   'Atraso tolerado (minutos) antes de aparecer como atraso na folha-ponto. A validar com o RH.'),
  ('hora_noturna', '{"inicio": "22:00", "fim": "05:00"}',
   'Faixa considerada noturna na apuração (minutos de relógio). A validar com o RH/contabilidade.'),
  ('horarios_turnos', '{"Manhã": {"inicio": "06:00", "fim": "14:00", "intervalo": 60}, "Tarde": {"inicio": "14:00", "fim": "22:00", "intervalo": 60}, "Noite": {"inicio": "22:00", "fim": "06:00", "intervalo": 60}}',
   'Horário sugerido ao escolher o turno na escala (pode ser ajustado em cada dia).'),
  ('feriados', '["2026-01-01", "2026-03-19", "2026-03-25", "2026-04-03", "2026-04-13", "2026-04-21", "2026-05-01", "2026-08-15", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25"]',
   'Feriados (AAAA-MM-DD) usados na folha-ponto: nacionais, Ceará e Fortaleza. Conferir e completar a cada ano.')
on conflict (chave) do nothing;

insert into public.permissoes (papel, modulo, acao) values
  ('gerente', 'ponto', 'cancelar'),
  ('rh', 'ponto', 'cancelar')
on conflict do nothing;
