-- COMPRAS E PEDIDOS: fornecedores, catálogo de produtos por categoria (Limpeza, Frios, Secos...), lista de pedidos
-- (solicitado → aprovado → comprado → recebido → concluído) e contas a pagar (boletos/vencimentos das planilhas).

-------------------------------------------------------------------------------
-- Fornecedores
-------------------------------------------------------------------------------
create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 1),
  categoria text,
  contato text,
  telefone text,
  cnpj text,
  prazo_dias int check (prazo_dias is null or prazo_dias between 0 and 180),
  forma_pagamento text,
  observacao text,
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now()
);

alter table public.fornecedores enable row level security;
create policy "ver fornecedores" on public.fornecedores for select to authenticated
  using ((select privado.pode('compras', 'ver')) or (select privado.pode('financeiro', 'ver')) or (select privado.pode('cartoes', 'ver')));
create policy "criar fornecedores" on public.fornecedores for insert to authenticated
  with check ((select privado.pode('compras', 'criar')) or (select privado.pode('financeiro', 'criar')));
create policy "editar fornecedores" on public.fornecedores for update to authenticated
  using ((select privado.pode('compras', 'editar')) or (select privado.pode('financeiro', 'editar')));
create policy "excluir fornecedores" on public.fornecedores for delete to authenticated
  using ((select privado.pode('compras', 'excluir')));
create trigger fornecedores_auditoria after insert or update or delete on public.fornecedores
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Catálogo de produtos
-------------------------------------------------------------------------------
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 1),
  categoria text not null default 'Secos',
  unidade text not null default 'un',
  fornecedor_id uuid references public.fornecedores (id),
  preco_referencia numeric(12, 2) check (preco_referencia is null or preco_referencia >= 0),
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  unique (nome, categoria)
);

alter table public.produtos enable row level security;
create policy "ver produtos" on public.produtos for select to authenticated using ((select privado.pode('compras', 'ver')));
create policy "criar produtos" on public.produtos for insert to authenticated with check ((select privado.pode('compras', 'criar')));
create policy "editar produtos" on public.produtos for update to authenticated using ((select privado.pode('compras', 'editar')));
create policy "excluir produtos" on public.produtos for delete to authenticated using ((select privado.pode('compras', 'excluir')));
create trigger produtos_auditoria after insert or update or delete on public.produtos
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Pedidos (lista de compras) e itens
-------------------------------------------------------------------------------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  titulo text not null check (length(trim(titulo)) > 0),
  categoria text,
  prioridade text not null default 'normal' check (prioridade in ('normal', 'urgente')),
  necessario_em date,
  fornecedor_id uuid references public.fornecedores (id),
  situacao text not null default 'solicitado'
    check (situacao in ('solicitado', 'aprovado', 'comprado', 'recebido', 'concluido', 'cancelado')),
  aprovado_por uuid references public.perfis (id),
  aprovado_em timestamptz,
  comprado_em date,
  recebido_em date,
  observacao text,
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index pedidos_situacao on public.pedidos (situacao, criado_em desc);

alter table public.pedidos enable row level security;
create policy "ver pedidos" on public.pedidos for select to authenticated using ((select privado.pode('compras', 'ver')));
create policy "criar pedidos" on public.pedidos for insert to authenticated
  with check ((select privado.pode('compras', 'criar')) and situacao = 'solicitado');
-- Quem cria pode mexer no próprio pedido enquanto está "solicitado"; o resto depende da permissão (gatilho).
create policy "alterar pedidos" on public.pedidos for update to authenticated
  using ((select privado.pode('compras', 'criar')) or (select privado.pode('compras', 'editar')) or (select privado.pode('compras', 'aprovar'))
         or (select privado.pode('compras', 'cancelar')));
create policy "excluir pedidos" on public.pedidos for delete to authenticated using ((select privado.pode('compras', 'excluir')));

create function public.controlar_pedido()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'cancelado' then
    raise exception 'Pedido cancelado não pode ser alterado.';
  end if;
  if new.situacao is distinct from old.situacao then
    if new.situacao = 'cancelado' and not privado.pode('compras', 'cancelar') and old.criado_por is distinct from auth.uid() then
      raise exception 'Você não tem permissão para cancelar este pedido.';
    elsif new.situacao = 'aprovado' then
      if not privado.pode('compras', 'aprovar') then raise exception 'Você não tem permissão para aprovar pedidos.'; end if;
      new.aprovado_por := auth.uid();
      new.aprovado_em := now();
    elsif new.situacao in ('comprado', 'recebido', 'concluido') and not privado.pode('compras', 'editar') and not privado.pode('compras', 'aprovar') then
      raise exception 'Você não tem permissão para avançar o pedido.';
    end if;
    if new.situacao = 'comprado' and new.comprado_em is null then new.comprado_em := (now() at time zone 'America/Fortaleza')::date; end if;
    if new.situacao = 'recebido' and new.recebido_em is null then new.recebido_em := (now() at time zone 'America/Fortaleza')::date; end if;
  elsif not privado.pode('compras', 'editar') and not (old.situacao = 'solicitado' and old.criado_por = auth.uid()) then
    raise exception 'Só dá para alterar o próprio pedido enquanto ele está solicitado.';
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger pedidos_controle before update on public.pedidos for each row execute function public.controlar_pedido();
create trigger pedidos_auditoria after insert or update or delete on public.pedidos
  for each row execute function public.registrar_auditoria();

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  produto_id uuid references public.produtos (id),
  descricao text not null check (length(trim(descricao)) > 0),
  quantidade numeric(12, 3) not null check (quantidade > 0),
  unidade text not null default 'un',
  preco_estimado numeric(12, 2) check (preco_estimado is null or preco_estimado >= 0),
  preco_real numeric(12, 2) check (preco_real is null or preco_real >= 0),
  quantidade_recebida numeric(12, 3) check (quantidade_recebida is null or quantidade_recebida >= 0),
  observacao text
);

create index pedido_itens_pedido on public.pedido_itens (pedido_id);

alter table public.pedido_itens enable row level security;
create policy "ver itens de pedido" on public.pedido_itens for select to authenticated using ((select privado.pode('compras', 'ver')));
-- Itens seguem as regras do pedido: o gatilho abaixo confere se o pedido pode ser mexido.
create policy "mexer em itens de pedido" on public.pedido_itens for all to authenticated
  using ((select privado.pode('compras', 'criar')) or (select privado.pode('compras', 'editar')))
  with check ((select privado.pode('compras', 'criar')) or (select privado.pode('compras', 'editar')));

create function public.controlar_itens_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pedidos;
begin
  select * into p from public.pedidos where id = coalesce(new.pedido_id, old.pedido_id);
  if p.id is null then return coalesce(new, old); end if; -- pedido sendo excluído (cascata)
  if p.situacao in ('cancelado', 'concluido') then
    raise exception 'Pedido % não aceita mudanças nos itens.', p.situacao;
  end if;
  if not privado.pode('compras', 'editar') and not (p.situacao = 'solicitado' and p.criado_por = auth.uid()) then
    raise exception 'Só dá para mudar itens do próprio pedido enquanto ele está solicitado.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger pedido_itens_controle before insert or update or delete on public.pedido_itens
  for each row execute function public.controlar_itens_pedido();
create trigger pedido_itens_auditoria after insert or update or delete on public.pedido_itens
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Contas a pagar (boletos, contas mensais, compras a prazo)
-------------------------------------------------------------------------------
create table public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  descricao text not null check (length(trim(descricao)) > 0),
  fornecedor_id uuid references public.fornecedores (id),
  categoria text not null default 'Insumos',
  valor numeric(12, 2) not null check (valor > 0),
  data_compra date,
  vencimento date not null,
  forma text check (forma is null or forma in ('boleto', 'pix', 'dinheiro', 'transferencia', 'cartao', 'debito_automatico', 'outro')),
  parcela text,
  pedido_id uuid references public.pedidos (id) on delete set null,
  situacao text not null default 'aberta' check (situacao in ('aberta', 'paga', 'cancelada')),
  pago_em date,
  valor_pago numeric(12, 2),
  pago_por uuid references public.perfis (id),
  observacao text,
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint paga_com_data check (situacao <> 'paga' or (pago_em is not null and valor_pago is not null)),
  constraint cancelamento_com_motivo check (situacao <> 'cancelada' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index contas_pagar_vencimento on public.contas_pagar (situacao, vencimento);

alter table public.contas_pagar enable row level security;
create policy "ver contas a pagar" on public.contas_pagar for select to authenticated
  using ((select privado.pode('financeiro', 'ver')) or (select privado.pode('compras', 'ver')));
create policy "lancar contas a pagar" on public.contas_pagar for insert to authenticated
  with check (((select privado.pode('financeiro', 'criar')) or (select privado.pode('compras', 'editar'))) and situacao = 'aberta');
create policy "alterar contas a pagar" on public.contas_pagar for update to authenticated
  using ((select privado.pode('financeiro', 'editar')) or (select privado.pode('financeiro', 'cancelar')) or (select privado.pode('financeiro', 'aprovar')));
create policy "excluir contas a pagar" on public.contas_pagar for delete to authenticated
  using ((select privado.pode('financeiro', 'excluir')));

create function public.controlar_conta_pagar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'cancelada' then raise exception 'Conta cancelada não pode ser alterada.'; end if;
  if new.situacao = 'cancelada' and old.situacao <> 'cancelada' and not privado.pode('financeiro', 'cancelar') then
    raise exception 'Você não tem permissão para cancelar contas.';
  end if;
  if new.situacao = 'paga' and old.situacao <> 'paga' then new.pago_por := auth.uid(); end if;
  if new.situacao = 'aberta' then new.pago_por := null; end if;
  return new;
end;
$$;

create trigger contas_pagar_controle before update on public.contas_pagar for each row execute function public.controlar_conta_pagar();
create trigger contas_pagar_auditoria after insert or update or delete on public.contas_pagar
  for each row execute function public.registrar_auditoria();

revoke execute on function public.controlar_pedido(), public.controlar_itens_pedido(), public.controlar_conta_pagar()
  from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Categorias e unidades (editáveis) e permissões
-------------------------------------------------------------------------------
insert into public.configuracoes (chave, valor, descricao) values
  ('compras_categorias', '["Limpeza", "Frios", "Secos", "Hortifruti", "Bebidas", "Padaria", "Descartáveis", "Utensílios"]',
   'Categorias do catálogo e da lista de pedidos.'),
  ('compras_unidades', '["un", "kg", "g", "L", "ml", "cx", "pct", "fardo", "bandeja", "dz"]', 'Unidades de medida dos produtos.'),
  ('contas_categorias', '["Insumos", "Limpeza", "Contas mensais", "Serviços", "Manutenção", "Investimento", "Impostos e taxas", "Pessoal", "Outros"]',
   'Categorias das contas a pagar (para o painel financeiro).')
on conflict (chave) do nothing;

insert into public.permissoes (papel, modulo, acao) values
  ('operador', 'compras', 'ver'),
  ('financeiro', 'compras', 'criar')
on conflict do nothing;
