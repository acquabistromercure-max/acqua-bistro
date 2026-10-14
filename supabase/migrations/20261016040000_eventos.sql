-- EVENTOS E COFFEE BREAK: clientes (empresas), modelos de coffee break com itens, produtos avulsos, eventos com fluxo
-- orçamento → confirmado → em andamento → encerrado → faturado → recebido, consumos lançados durante o evento
-- (produto, quantidade, valor, horário, operador) e equipe/diárias ligadas ao evento.

-------------------------------------------------------------------------------
-- Clientes / contratantes (empresas ou pessoas)
-------------------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 1),
  documento text,
  contato text,
  telefone text,
  email text,
  observacao text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now()
);
alter table public.clientes enable row level security;
create policy "ver clientes" on public.clientes for select to authenticated
  using ((select privado.pode('eventos', 'ver')) or (select privado.pode('cafes', 'ver')) or (select privado.pode('contas', 'ver')));
create policy "criar clientes" on public.clientes for insert to authenticated
  with check ((select privado.pode('eventos', 'criar')) or (select privado.pode('cafes', 'criar')));
create policy "editar clientes" on public.clientes for update to authenticated using ((select privado.pode('eventos', 'editar')));
create policy "excluir clientes" on public.clientes for delete to authenticated using ((select privado.pode('eventos', 'excluir')));
create trigger clientes_auditoria after insert or update or delete on public.clientes
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Modelos de coffee break (itens com unidade, quantidade por pessoa) e produtos avulsos
-------------------------------------------------------------------------------
create table public.evento_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 1),
  descricao text,
  preco_por_pessoa numeric(12, 2) not null default 0 check (preco_por_pessoa >= 0),
  itens jsonb not null default '[]'::jsonb, -- [{ "nome": "Pão de queijo", "unidade": "un", "por_pessoa": 3 }]
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint itens_lista check (jsonb_typeof(itens) = 'array')
);
alter table public.evento_modelos enable row level security;
create policy "ver modelos" on public.evento_modelos for select to authenticated using ((select privado.pode('eventos', 'ver')));
create policy "criar modelos" on public.evento_modelos for insert to authenticated with check ((select privado.pode('eventos', 'editar')));
create policy "editar modelos" on public.evento_modelos for update to authenticated using ((select privado.pode('eventos', 'editar')));
create policy "excluir modelos" on public.evento_modelos for delete to authenticated using ((select privado.pode('eventos', 'excluir')));
create trigger evento_modelos_auditoria after insert or update or delete on public.evento_modelos
  for each row execute function public.registrar_auditoria();

create table public.evento_produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 1),
  unidade text not null default 'un',
  preco numeric(12, 2) not null check (preco >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.evento_produtos enable row level security;
create policy "ver produtos de evento" on public.evento_produtos for select to authenticated using ((select privado.pode('eventos', 'ver')));
create policy "criar produtos de evento" on public.evento_produtos for insert to authenticated with check ((select privado.pode('eventos', 'editar')));
create policy "editar produtos de evento" on public.evento_produtos for update to authenticated using ((select privado.pode('eventos', 'editar')));
create policy "excluir produtos de evento" on public.evento_produtos for delete to authenticated using ((select privado.pode('eventos', 'excluir')));
create trigger evento_produtos_auditoria after insert or update or delete on public.evento_produtos
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Eventos
-------------------------------------------------------------------------------
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 1),
  cliente_id uuid references public.clientes (id),
  contato text,
  telefone text,
  data date not null,
  hora_inicio time,
  hora_fim time,
  local text,
  pessoas int not null default 0 check (pessoas >= 0),
  modelo_id uuid references public.evento_modelos (id),
  preco_por_pessoa numeric(12, 2) not null default 0 check (preco_por_pessoa >= 0),
  cardapio text,
  valor_adicional numeric(12, 2) not null default 0, -- taxas/serviços combinados à parte (pode ser negativo = desconto)
  sinal numeric(12, 2) not null default 0 check (sinal >= 0),
  sinal_pago_em date,
  situacao text not null default 'orcamento'
    check (situacao in ('orcamento', 'confirmado', 'em_andamento', 'encerrado', 'faturado', 'recebido', 'cancelado')),
  faturar_hotel boolean not null default false, -- entra na quinzena com o hotel
  valor_recebido numeric(12, 2),
  recebido_em date,
  observacao text,
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint recebido_com_valor check (situacao <> 'recebido' or (valor_recebido is not null and recebido_em is not null)),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);
create index eventos_data on public.eventos (data);
alter table public.eventos enable row level security;
create policy "ver eventos" on public.eventos for select to authenticated using ((select privado.pode('eventos', 'ver')));
create policy "criar eventos" on public.eventos for insert to authenticated
  with check ((select privado.pode('eventos', 'criar')) and situacao = 'orcamento');
create policy "alterar eventos" on public.eventos for update to authenticated
  using ((select privado.pode('eventos', 'editar')) or (select privado.pode('eventos', 'aprovar')) or (select privado.pode('eventos', 'cancelar'))
         or (select privado.pode('eventos', 'criar')));
create policy "excluir eventos" on public.eventos for delete to authenticated using ((select privado.pode('eventos', 'excluir')));

create function public.controlar_evento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'cancelado' then raise exception 'Evento cancelado não pode ser alterado.'; end if;
  if new.situacao is distinct from old.situacao then
    if new.situacao = 'cancelado' and not privado.pode('eventos', 'cancelar') then
      raise exception 'Você não tem permissão para cancelar eventos.';
    elsif new.situacao = 'confirmado' and old.situacao = 'orcamento' and not privado.pode('eventos', 'aprovar') and not privado.pode('eventos', 'editar') then
      raise exception 'Você não tem permissão para confirmar eventos.';
    elsif new.situacao in ('faturado', 'recebido') and not privado.pode('eventos', 'editar') then
      raise exception 'Faturar e receber é com gerente ou financeiro.';
    end if;
  elsif not privado.pode('eventos', 'editar') and not (old.situacao = 'orcamento' and old.criado_por = auth.uid()) then
    raise exception 'Você só pode alterar um orçamento criado por você.';
  end if;
  -- "em andamento" e "encerrado" o operador do evento pode marcar (fluxo do dia).
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger eventos_controle before update on public.eventos for each row execute function public.controlar_evento();
create trigger eventos_auditoria after insert or update or delete on public.eventos
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Consumos durante o evento (produtos avulsos)
-------------------------------------------------------------------------------
create table public.evento_consumos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  momento timestamptz not null default now(),
  produto text not null check (length(trim(produto)) > 0),
  quantidade numeric(12, 3) not null check (quantidade > 0),
  preco_unitario numeric(12, 2) not null check (preco_unitario >= 0),
  total numeric(12, 2) generated always as (round(quantidade * preco_unitario, 2)) stored,
  observacao text,
  situacao text not null default 'registrado' check (situacao in ('registrado', 'cancelado')),
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);
create index evento_consumos_evento on public.evento_consumos (evento_id);
alter table public.evento_consumos enable row level security;
create policy "ver consumos" on public.evento_consumos for select to authenticated using ((select privado.pode('eventos', 'ver')));
create policy "lancar consumo" on public.evento_consumos for insert to authenticated
  with check ((select privado.pode('eventos', 'criar')) and situacao = 'registrado');
create policy "alterar consumo" on public.evento_consumos for update to authenticated
  using ((select privado.pode('eventos', 'editar')) or (select privado.pode('eventos', 'cancelar')));
create policy "excluir consumo" on public.evento_consumos for delete to authenticated using ((select privado.pode('eventos', 'excluir')));

-- Depois de faturado/recebido/cancelado, o demonstrativo não muda.
create function public.bloquear_consumo_evento_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.eventos e
    where e.id = coalesce(new.evento_id, old.evento_id) and e.situacao in ('faturado', 'recebido', 'cancelado')
  ) then
    raise exception 'Este evento já foi faturado ou cancelado: os consumos não mudam mais.';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger evento_consumos_fechado before insert or update or delete on public.evento_consumos
  for each row execute function public.bloquear_consumo_evento_fechado();
create trigger evento_consumos_situacao before update on public.evento_consumos
  for each row execute function public.controlar_situacao('eventos');
create trigger evento_consumos_auditoria after insert or update or delete on public.evento_consumos
  for each row execute function public.registrar_auditoria();

revoke execute on function public.controlar_evento(), public.bloquear_consumo_evento_fechado() from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Equipe: diárias ligadas ao evento
-------------------------------------------------------------------------------
alter table public.diarias add column evento_id uuid references public.eventos (id) on delete set null;
create index diarias_evento on public.diarias (evento_id) where evento_id is not null;

insert into public.permissoes (papel, modulo, acao) values
  ('financeiro', 'eventos', 'aprovar')
on conflict do nothing;
