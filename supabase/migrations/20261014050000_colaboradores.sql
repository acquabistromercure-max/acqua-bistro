-- COLABORADORES E DIARISTAS: ficha, dados bancários protegidos, ocorrências, financeiro do colaborador e diárias.

-------------------------------------------------------------------------------
-- Função genérica: atualiza "atualizado_em" (substitui o uso da antiga atualizar_data_perfil)
-------------------------------------------------------------------------------
create function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- Colaboradores (inclui diaristas/eventuais). Ninguém é apagado: desligado fica inativo.
-------------------------------------------------------------------------------
create type public.vinculo_colaborador as enum ('clt', 'diarista', 'temporario', 'estagiario', 'pj', 'outro');
create type public.situacao_colaborador as enum ('ativo', 'afastado', 'desligado');
create type public.tipo_remuneracao as enum ('mensal', 'diaria', 'turno', 'hora');

create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 1),
  apelido text,
  cpf text unique check (cpf ~ '^\d{11}$'),
  rg text,
  data_nascimento date,
  telefone text,
  email text,
  endereco text,
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  funcao text,
  vinculo public.vinculo_colaborador not null default 'clt',
  situacao public.situacao_colaborador not null default 'ativo',
  data_admissao date,
  data_desligamento date,
  motivo_desligamento text,
  jornada_descricao text,
  jornada_semanal_horas numeric(5, 2) check (jornada_semanal_horas is null or jornada_semanal_horas between 0 and 80),
  tipo_remuneracao public.tipo_remuneracao not null default 'mensal',
  remuneracao numeric(12, 2) check (remuneracao is null or remuneracao >= 0),
  observacoes text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint desligamento_com_data check (situacao <> 'desligado' or data_desligamento is not null),
  constraint datas_coerentes check (data_desligamento is null or data_admissao is null or data_desligamento >= data_admissao)
);

create index colaboradores_nome on public.colaboradores (nome);

alter table public.colaboradores enable row level security;

create policy "ver colaboradores" on public.colaboradores for select to authenticated
  using ((select privado.pode('colaboradores', 'ver')));
create policy "criar colaboradores" on public.colaboradores for insert to authenticated
  with check ((select privado.pode('colaboradores', 'criar')));
create policy "editar colaboradores" on public.colaboradores for update to authenticated
  using ((select privado.pode('colaboradores', 'editar'))) with check ((select privado.pode('colaboradores', 'editar')));

create trigger colaboradores_atualizado_em before update on public.colaboradores
  for each row execute function public.tocar_atualizado_em();
create trigger colaboradores_auditoria after insert or update or delete on public.colaboradores
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Dados bancários: tabela separada, só quem tem a permissão "dados_bancarios"
-------------------------------------------------------------------------------
create table public.colaboradores_bancarios (
  colaborador_id uuid primary key references public.colaboradores (id),
  banco text,
  agencia text,
  conta text,
  tipo_conta text check (tipo_conta is null or tipo_conta in ('corrente', 'poupanca', 'salario', 'pagamento')),
  titular text,
  pix_tipo text check (pix_tipo is null or pix_tipo in ('cpf', 'telefone', 'email', 'aleatoria')),
  pix_chave text,
  atualizado_em timestamptz not null default now()
);

alter table public.colaboradores_bancarios enable row level security;

create policy "ver dados bancarios" on public.colaboradores_bancarios for select to authenticated
  using ((select privado.pode('dados_bancarios', 'ver')));
create policy "criar dados bancarios" on public.colaboradores_bancarios for insert to authenticated
  with check ((select privado.pode('dados_bancarios', 'editar')));
create policy "editar dados bancarios" on public.colaboradores_bancarios for update to authenticated
  using ((select privado.pode('dados_bancarios', 'editar'))) with check ((select privado.pode('dados_bancarios', 'editar')));

create trigger colaboradores_bancarios_atualizado_em before update on public.colaboradores_bancarios
  for each row execute function public.tocar_atualizado_em();
create trigger colaboradores_bancarios_auditoria after insert or update or delete on public.colaboradores_bancarios
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Ocorrências: faltas, atrasos, atestados, advertências... Registro ≠ aprovação ≠ desconto.
-------------------------------------------------------------------------------
create type public.tipo_ocorrencia as enum (
  'falta', 'atraso', 'atestado', 'justificativa', 'advertencia', 'ocorrencia', 'elogio'
);
create type public.situacao_registro as enum ('registrada', 'aprovada', 'cancelada');

create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id),
  tipo public.tipo_ocorrencia not null,
  data date not null,
  descricao text not null check (length(trim(descricao)) > 0),
  minutos int check (minutos is null or minutos > 0),
  dias int check (dias is null or dias > 0),
  situacao public.situacao_registro not null default 'registrada',
  aprovado_por uuid references public.perfis (id),
  aprovado_em timestamptz,
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint cancelamento_com_motivo check (situacao <> 'cancelada' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index ocorrencias_colaborador on public.ocorrencias (colaborador_id, data desc);

alter table public.ocorrencias enable row level security;

create policy "ver ocorrencias" on public.ocorrencias for select to authenticated
  using ((select privado.pode('ocorrencias', 'ver')));
create policy "criar ocorrencias" on public.ocorrencias for insert to authenticated
  with check ((select privado.pode('ocorrencias', 'criar')) and situacao = 'registrada');
-- Edição, aprovação e cancelamento passam pelas checagens do gatilho abaixo.
create policy "alterar ocorrencias" on public.ocorrencias for update to authenticated
  using (
    (select privado.pode('ocorrencias', 'editar')) or (select privado.pode('ocorrencias', 'aprovar'))
    or (select privado.pode('ocorrencias', 'cancelar'))
  );

-------------------------------------------------------------------------------
-- Regra comum de "aprovar / cancelar": exige a permissão certa, carimba quem e quando,
-- e impede mexer em registro já cancelado. Usada por várias tabelas (passa o módulo no gatilho).
-------------------------------------------------------------------------------
create function public.controlar_situacao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_modulo text := tg_argv[0];
begin
  if old.situacao::text = 'cancelada' or old.situacao::text = 'cancelado' then
    raise exception 'Registro cancelado não pode ser alterado.';
  end if;
  if new.situacao::text in ('cancelada', 'cancelado') and old.situacao is distinct from new.situacao then
    if not privado.pode(v_modulo, 'cancelar') then
      raise exception 'Você não tem permissão para cancelar.';
    end if;
  elsif new.situacao::text in ('aprovada', 'aprovado') and old.situacao is distinct from new.situacao then
    if not privado.pode(v_modulo, 'aprovar') then
      raise exception 'Você não tem permissão para aprovar.';
    end if;
    new.aprovado_por := auth.uid();
    new.aprovado_em := now();
  elsif not privado.pode(v_modulo, 'editar') and not privado.pode(v_modulo, 'aprovar') then
    raise exception 'Você não tem permissão para editar.';
  end if;
  return new;
end;
$$;

create trigger ocorrencias_situacao before update on public.ocorrencias
  for each row execute function public.controlar_situacao('ocorrencias');
create trigger ocorrencias_auditoria after insert or update or delete on public.ocorrencias
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Financeiro do colaborador: vales, adiantamentos, pagamentos, descontos.
-- "origem" garante que um mesmo fato (ex.: retirada do caixa) gere UM lançamento só.
-------------------------------------------------------------------------------
create type public.tipo_lancamento_colaborador as enum ('vale', 'adiantamento', 'pagamento', 'diaria', 'desconto', 'outro');
create type public.situacao_lancamento as enum ('pendente', 'aprovado', 'pago', 'cancelado');

create table public.lancamentos_colaborador (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id),
  tipo public.tipo_lancamento_colaborador not null,
  data date not null,
  valor numeric(12, 2) not null check (valor > 0),
  descricao text,
  competencia text check (competencia is null or competencia ~ '^\d{4}-\d{2}$'),
  situacao public.situacao_lancamento not null default 'pendente',
  aprovado_por uuid references public.perfis (id),
  aprovado_em timestamptz,
  motivo_cancelamento text,
  origem_tipo text,
  origem_id uuid,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  unique (origem_tipo, origem_id),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index lancamentos_colaborador_colab on public.lancamentos_colaborador (colaborador_id, data desc);

alter table public.lancamentos_colaborador enable row level security;

create policy "ver lancamentos do colaborador" on public.lancamentos_colaborador for select to authenticated
  using ((select privado.pode('financeiro', 'ver')));
create policy "criar lancamentos do colaborador" on public.lancamentos_colaborador for insert to authenticated
  with check ((select privado.pode('financeiro', 'criar')) and situacao = 'pendente');
create policy "alterar lancamentos do colaborador" on public.lancamentos_colaborador for update to authenticated
  using (
    (select privado.pode('financeiro', 'editar')) or (select privado.pode('financeiro', 'aprovar'))
    or (select privado.pode('financeiro', 'cancelar'))
  );

create trigger lancamentos_colaborador_situacao before update on public.lancamentos_colaborador
  for each row execute function public.controlar_situacao('financeiro');
create trigger lancamentos_colaborador_auditoria after insert or update or delete on public.lancamentos_colaborador
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Diárias: convocação de diaristas/eventuais. Vínculo com evento é incluído no módulo de eventos.
-------------------------------------------------------------------------------
create type public.situacao_diaria as enum ('convocada', 'trabalhada', 'aprovada', 'paga', 'cancelada');

create table public.diarias (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores (id),
  data date not null,
  turno text,
  funcao text,
  valor numeric(12, 2) not null check (valor >= 0),
  situacao public.situacao_diaria not null default 'convocada',
  aprovado_por uuid references public.perfis (id),
  aprovado_em timestamptz,
  motivo_cancelamento text,
  observacao text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint cancelamento_com_motivo check (situacao <> 'cancelada' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index diarias_data on public.diarias (data desc);
create index diarias_colaborador on public.diarias (colaborador_id, data desc);

alter table public.diarias enable row level security;

create policy "ver diarias" on public.diarias for select to authenticated
  using ((select privado.pode('colaboradores', 'ver')));
create policy "criar diarias" on public.diarias for insert to authenticated
  with check ((select privado.pode('colaboradores', 'criar')) and situacao in ('convocada', 'trabalhada'));
create policy "alterar diarias" on public.diarias for update to authenticated
  using (
    (select privado.pode('colaboradores', 'editar')) or (select privado.pode('colaboradores', 'aprovar'))
    or (select privado.pode('colaboradores', 'cancelar'))
  );

create trigger diarias_situacao before update on public.diarias
  for each row execute function public.controlar_situacao('colaboradores');
create trigger diarias_auditoria after insert or update or delete on public.diarias
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Permissões novas
-------------------------------------------------------------------------------
insert into public.permissoes (papel, modulo, acao) values
  ('gerente', 'colaboradores', 'aprovar'), ('gerente', 'colaboradores', 'cancelar'),
  ('rh', 'colaboradores', 'aprovar'), ('rh', 'colaboradores', 'cancelar'),
  ('rh', 'financeiro', 'criar'),
  ('gerente', 'financeiro', 'criar'), ('gerente', 'financeiro', 'cancelar')
on conflict do nothing;
