-- CARTÃO EMPRESA: cartões (só banco, apelido, 4 últimos dígitos, fechamento e vencimento — nunca número completo
-- ou CVV), compras com itens e parcelas, e pagamento das faturas. As parcelas de cada fatura são calculadas a partir
-- da compra (registrada uma vez só).

create table public.cartoes (
  id uuid primary key default gen_random_uuid(),
  apelido text not null check (length(trim(apelido)) > 0),
  banco text not null,
  final text not null check (final ~ '^\d{4}$'),
  titular text,
  tipo text not null default 'empresa' check (tipo in ('empresa', 'pessoal')), -- pessoal = cartão de alguém, a reembolsar
  fechamento_dia int not null check (fechamento_dia between 1 and 31),
  vencimento_dia int not null check (vencimento_dia between 1 and 31),
  limite numeric(12, 2) check (limite is null or limite >= 0),
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now()
);

alter table public.cartoes enable row level security;
create policy "ver cartoes" on public.cartoes for select to authenticated using ((select privado.pode('cartoes', 'ver')));
create policy "criar cartoes" on public.cartoes for insert to authenticated with check ((select privado.pode('cartoes', 'criar')));
create policy "editar cartoes" on public.cartoes for update to authenticated using ((select privado.pode('cartoes', 'editar')));
create policy "excluir cartoes" on public.cartoes for delete to authenticated using ((select privado.pode('cartoes', 'excluir')));
create trigger cartoes_auditoria after insert or update or delete on public.cartoes
  for each row execute function public.registrar_auditoria();

create table public.compras_cartao (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references public.cartoes (id),
  data date not null,
  estabelecimento text not null check (length(trim(estabelecimento)) > 0),
  fornecedor_id uuid references public.fornecedores (id),
  itens text not null check (length(trim(itens)) > 0),
  categoria text not null default 'Insumos',
  valor_total numeric(12, 2) not null check (valor_total > 0),
  parcelas int not null default 1 check (parcelas between 1 and 24),
  responsavel text not null check (length(trim(responsavel)) > 0),
  comprovante_ok boolean not null default false,
  observacao text,
  situacao text not null default 'registrado' check (situacao in ('registrado', 'cancelado')),
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index compras_cartao_data on public.compras_cartao (cartao_id, data);

alter table public.compras_cartao enable row level security;
create policy "ver compras no cartao" on public.compras_cartao for select to authenticated using ((select privado.pode('cartoes', 'ver')));
create policy "lancar compra no cartao" on public.compras_cartao for insert to authenticated
  with check ((select privado.pode('cartoes', 'criar')) and situacao = 'registrado');
create policy "alterar compra no cartao" on public.compras_cartao for update to authenticated
  using ((select privado.pode('cartoes', 'editar')) or (select privado.pode('cartoes', 'cancelar')));
create policy "excluir compra no cartao" on public.compras_cartao for delete to authenticated using ((select privado.pode('cartoes', 'excluir')));
create trigger compras_cartao_situacao before update on public.compras_cartao
  for each row execute function public.controlar_situacao('cartoes');
create trigger compras_cartao_auditoria after insert or update or delete on public.compras_cartao
  for each row execute function public.registrar_auditoria();

-- Fatura paga (por cartão e mês de vencimento).
create table public.faturas_cartao (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references public.cartoes (id),
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'), -- mês do vencimento
  valor_calculado numeric(12, 2) not null,
  valor_pago numeric(12, 2) not null check (valor_pago >= 0),
  pago_em date not null,
  observacao text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  unique (cartao_id, competencia)
);

alter table public.faturas_cartao enable row level security;
create policy "ver faturas" on public.faturas_cartao for select to authenticated using ((select privado.pode('cartoes', 'ver')));
create policy "pagar fatura" on public.faturas_cartao for insert to authenticated with check ((select privado.pode('cartoes', 'editar')));
create policy "corrigir fatura" on public.faturas_cartao for update to authenticated using ((select privado.pode('cartoes', 'editar')));
create policy "excluir fatura" on public.faturas_cartao for delete to authenticated
  using ((select privado.pode('cartoes', 'editar')) or (select privado.pode('cartoes', 'excluir')));
create trigger faturas_cartao_auditoria after insert or update or delete on public.faturas_cartao
  for each row execute function public.registrar_auditoria();

insert into public.permissoes (papel, modulo, acao) values ('gerente', 'cartoes', 'cancelar') on conflict do nothing;
