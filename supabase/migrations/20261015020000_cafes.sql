-- CAFÉ E HOTEL (desenhado a partir das planilhas reais da operação):
-- * cafe_dias: hóspedes e cafés servidos por dia (base do faturamento ao hotel, com café garantido e tickets);
-- * cafe_ajustes: "por fora da lista" (apartamentos a mais/a menos, com motivo e autorização);
-- * consumos_quarto: borderô (consumo lançado na conta do quarto e entregue à recepção);
-- * cafe_mensalistas + cafe_vendas: cafés pagos na hora (extras/passantes) ou a receber de mensalistas;
-- * quinzenas_hotel: fechamento quinzenal Restaurante × Hotel (trava os lançamentos da quinzena).
-- Valores do contrato (preço, % garantido, itens) NÃO ficam aqui: o administrador preenche na tela Regras.

-------------------------------------------------------------------------------
-- Dia do hotel. Valor e percentual são "fotografados" no lançamento: mudar a regra não altera o passado.
-------------------------------------------------------------------------------
create table public.cafe_dias (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  hospedes int not null check (hospedes >= 0),
  cafes_servidos int not null check (cafes_servidos >= 0),
  valor_cafe numeric(12, 2) not null check (valor_cafe >= 0),
  percentual_garantido numeric(5, 2) not null check (percentual_garantido between 0 and 100),
  observacao text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.cafe_dias enable row level security;

create policy "ver dias do cafe" on public.cafe_dias for select to authenticated
  using ((select privado.pode('cafes', 'ver')));
create policy "lancar dia do cafe" on public.cafe_dias for insert to authenticated
  with check ((select privado.pode('cafes', 'criar')));
create policy "corrigir dia do cafe" on public.cafe_dias for update to authenticated
  using ((select privado.pode('cafes', 'editar'))) with check ((select privado.pode('cafes', 'editar')));

create trigger cafe_dias_atualizado_em before update on public.cafe_dias
  for each row execute function public.tocar_atualizado_em();
create trigger cafe_dias_auditoria after insert or update or delete on public.cafe_dias
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Ajustes "por fora da lista": quantidade positiva cobra do hotel, negativa desconta.
-------------------------------------------------------------------------------
create type public.motivo_ajuste_cafe as enum (
  'late_checkin', 'fora_da_ventilacao', 'pessoa_adicional', 'liberado_gestor', 'sem_direito',
  'faturado_hotelaria', 'faturar_empresa', 'outro'
);

create table public.cafe_ajustes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  apartamento text not null check (length(trim(apartamento)) > 0),
  hospede text,
  quantidade int not null check (quantidade <> 0),
  valor_unitario numeric(12, 2) not null check (valor_unitario >= 0),
  total numeric(12, 2) generated always as (quantidade * valor_unitario) stored,
  motivo public.motivo_ajuste_cafe not null,
  autorizado_por text,
  descricao text,
  situacao text not null default 'registrado' check (situacao in ('registrado', 'cancelado')),
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint liberado_com_autorizacao check (motivo <> 'liberado_gestor' or length(trim(coalesce(autorizado_por, ''))) > 0),
  constraint outro_com_descricao check (motivo <> 'outro' or length(trim(coalesce(descricao, ''))) > 0),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index cafe_ajustes_data on public.cafe_ajustes (data);

alter table public.cafe_ajustes enable row level security;

create policy "ver ajustes do cafe" on public.cafe_ajustes for select to authenticated
  using ((select privado.pode('cafes', 'ver')));
create policy "lancar ajuste do cafe" on public.cafe_ajustes for insert to authenticated
  with check ((select privado.pode('cafes', 'criar')) and situacao = 'registrado');
create policy "alterar ajuste do cafe" on public.cafe_ajustes for update to authenticated
  using ((select privado.pode('cafes', 'editar')) or (select privado.pode('cafes', 'cancelar')));

create trigger cafe_ajustes_situacao before update on public.cafe_ajustes
  for each row execute function public.controlar_situacao('cafes');
create trigger cafe_ajustes_auditoria after insert or update or delete on public.cafe_ajustes
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Borderô: consumo na conta do quarto, entregue à recepção para lançamento pelo hotel.
-------------------------------------------------------------------------------
create table public.consumos_quarto (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  apartamento text not null check (length(trim(apartamento)) > 0),
  item text not null check (length(trim(item)) > 0),
  quantidade int not null default 1 check (quantidade > 0),
  valor_unitario numeric(12, 2) not null check (valor_unitario >= 0),
  total numeric(12, 2) generated always as (quantidade * valor_unitario) stored,
  observacao text,
  entregue_recepcao boolean not null default false,
  entregue_a text,
  entregue_em timestamptz,
  situacao text not null default 'registrado' check (situacao in ('registrado', 'cancelado')),
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index consumos_quarto_data on public.consumos_quarto (data);

alter table public.consumos_quarto enable row level security;

create policy "ver bordero" on public.consumos_quarto for select to authenticated
  using ((select privado.pode('cafes', 'ver')));
create policy "lancar bordero" on public.consumos_quarto for insert to authenticated
  with check ((select privado.pode('cafes', 'criar')) and situacao = 'registrado');
-- Marcar "entregue na recepção" é tarefa do dia a dia: quem lança também pode marcar (o gatilho controla o resto).
create policy "alterar bordero" on public.consumos_quarto for update to authenticated
  using (
    (select privado.pode('cafes', 'criar')) or (select privado.pode('cafes', 'editar'))
    or (select privado.pode('cafes', 'cancelar'))
  );

-- Quem só lança (sem "editar") pode apenas marcar a entrega na recepção.
create function public.controlar_bordero()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'cancelado' then
    raise exception 'Registro cancelado não pode ser alterado.';
  end if;
  if new.situacao = 'cancelado' and old.situacao <> 'cancelado' then
    if not privado.pode('cafes', 'cancelar') then
      raise exception 'Você não tem permissão para cancelar.';
    end if;
    return new;
  end if;
  if not privado.pode('cafes', 'editar')
     and (new.data, new.apartamento, new.item, new.quantidade, new.valor_unitario, new.observacao)
         is distinct from (old.data, old.apartamento, old.item, old.quantidade, old.valor_unitario, old.observacao) then
    raise exception 'Você não tem permissão para corrigir o lançamento; só para marcar a entrega na recepção.';
  end if;
  if new.entregue_recepcao and not old.entregue_recepcao then
    new.entregue_em := now();
  elsif not new.entregue_recepcao then
    new.entregue_em := null;
    new.entregue_a := null;
  end if;
  return new;
end;
$$;

create trigger consumos_quarto_controle before update on public.consumos_quarto
  for each row execute function public.controlar_bordero();
create trigger consumos_quarto_auditoria after insert or update or delete on public.consumos_quarto
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Mensalistas (hóspedes de longa estadia que acertam os cafés de tempos em tempos)
-------------------------------------------------------------------------------
create table public.cafe_mensalistas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 1),
  apartamento text,
  ativo boolean not null default true,
  observacao text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now()
);

alter table public.cafe_mensalistas enable row level security;

create policy "ver mensalistas" on public.cafe_mensalistas for select to authenticated
  using ((select privado.pode('cafes', 'ver')));
create policy "criar mensalistas" on public.cafe_mensalistas for insert to authenticated
  with check ((select privado.pode('cafes', 'criar')));
create policy "editar mensalistas" on public.cafe_mensalistas for update to authenticated
  using ((select privado.pode('cafes', 'editar'))) with check ((select privado.pode('cafes', 'editar')));

create trigger cafe_mensalistas_auditoria after insert or update or delete on public.cafe_mensalistas
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Vendas de café pagas direto ao restaurante (extras, passantes) ou a receber de mensalista.
-- Forma de pagamento e bandeira alimentam o caixa (módulo seguinte) sem redigitação.
-------------------------------------------------------------------------------
create type public.forma_recebimento as enum ('dinheiro', 'pix', 'credito', 'debito', 'outro');
create type public.bandeira_cartao as enum ('visa', 'mastercard', 'amex', 'elo', 'outra');

create table public.cafe_vendas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  cliente text not null check (length(trim(cliente)) > 0), -- apartamento, "Passante" ou nome
  mensalista_id uuid references public.cafe_mensalistas (id),
  quantidade int not null default 1 check (quantidade > 0),
  valor_total numeric(12, 2) not null check (valor_total >= 0),
  pago boolean not null default true,
  forma public.forma_recebimento,
  bandeira public.bandeira_cartao,
  recebido_em date,
  conferido boolean not null default false,
  conferido_por uuid references public.perfis (id),
  conferido_em timestamptz,
  observacao text,
  situacao text not null default 'registrado' check (situacao in ('registrado', 'cancelado')),
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint pago_com_forma check (not pago or (forma is not null and recebido_em is not null)),
  constraint a_receber_de_mensalista check (pago or mensalista_id is not null),
  constraint cartao_com_bandeira check (forma not in ('credito', 'debito') or bandeira is not null),
  constraint bandeira_so_cartao check (bandeira is null or forma in ('credito', 'debito')),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index cafe_vendas_data on public.cafe_vendas (data);
create index cafe_vendas_mensalista on public.cafe_vendas (mensalista_id) where not pago;

alter table public.cafe_vendas enable row level security;

create policy "ver vendas de cafe" on public.cafe_vendas for select to authenticated
  using ((select privado.pode('cafes', 'ver')));
create policy "lancar venda de cafe" on public.cafe_vendas for insert to authenticated
  with check ((select privado.pode('cafes', 'criar')) and situacao = 'registrado' and not conferido);
create policy "alterar venda de cafe" on public.cafe_vendas for update to authenticated
  using ((select privado.pode('cafes', 'editar')) or (select privado.pode('cafes', 'cancelar')));

-- Conferência carimbada (quem e quando).
create function public.carimbar_conferencia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.conferido and not old.conferido then
    new.conferido_por := auth.uid();
    new.conferido_em := now();
  elsif not new.conferido then
    new.conferido_por := null;
    new.conferido_em := null;
  end if;
  return new;
end;
$$;

create trigger cafe_vendas_conferencia before update on public.cafe_vendas
  for each row execute function public.carimbar_conferencia();
create trigger cafe_vendas_situacao before update on public.cafe_vendas
  for each row execute function public.controlar_situacao('cafes');
create trigger cafe_vendas_auditoria after insert or update or delete on public.cafe_vendas
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Fechamento da quinzena com o hotel (Restaurante × Hotel). Enviada/paga trava os lançamentos do período.
-------------------------------------------------------------------------------
create table public.quinzenas_hotel (
  id uuid primary key default gen_random_uuid(),
  inicio date not null,
  fim date not null,
  situacao text not null default 'enviada' check (situacao in ('enviada', 'paga', 'reaberta')),
  resumo jsonb not null default '{}'::jsonb,       -- valores calculados pelo restaurante
  reconhecido jsonb not null default '{}'::jsonb,  -- valores aceitos pelo hotel, por linha
  valor_pago numeric(12, 2),
  pago_em date,
  observacao text,
  motivo_reabertura text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint periodo_valido check (fim >= inicio and fim - inicio <= 16),
  constraint paga_com_valor check (situacao <> 'paga' or (valor_pago is not null and pago_em is not null)),
  constraint reabertura_com_motivo check (situacao <> 'reaberta' or length(trim(coalesce(motivo_reabertura, ''))) > 0)
);

create unique index quinzenas_hotel_uma_ativa on public.quinzenas_hotel (inicio) where situacao <> 'reaberta';

alter table public.quinzenas_hotel enable row level security;

create policy "ver quinzenas" on public.quinzenas_hotel for select to authenticated
  using ((select privado.pode('cafes', 'ver')));
create policy "fechar quinzena" on public.quinzenas_hotel for insert to authenticated
  with check ((select privado.pode('cafes', 'aprovar')) and situacao = 'enviada');
create policy "atualizar quinzena" on public.quinzenas_hotel for update to authenticated
  using ((select privado.pode('cafes', 'aprovar'))) with check ((select privado.pode('cafes', 'aprovar')));

create function public.controlar_quinzena()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'reaberta' then
    raise exception 'Esta quinzena já foi reaberta. Para fechar de novo, faça um novo fechamento.';
  end if;
  if new.inicio <> old.inicio or new.fim <> old.fim or new.resumo is distinct from old.resumo then
    raise exception 'O período e os valores do restaurante não mudam depois de enviados. Reabra a quinzena.';
  end if;
  return new;
end;
$$;

create trigger quinzenas_hotel_atualizado_em before update on public.quinzenas_hotel
  for each row execute function public.tocar_atualizado_em();
create trigger quinzenas_hotel_controle before update on public.quinzenas_hotel
  for each row execute function public.controlar_quinzena();
create trigger quinzenas_hotel_auditoria after insert or update or delete on public.quinzenas_hotel
  for each row execute function public.registrar_auditoria();

-- Trava: dia, ajuste e borderô de quinzena enviada/paga não mudam (é preciso reabrir).
create function public.bloquear_quinzena_fechada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.quinzenas_hotel q
    where q.situacao <> 'reaberta'
      and (new.data between q.inicio and q.fim or (tg_op = 'UPDATE' and old.data between q.inicio and q.fim))
  ) then
    raise exception 'Esta quinzena já foi enviada ao hotel. Reabra a quinzena para alterar.';
  end if;
  return new;
end;
$$;

create trigger cafe_dias_quinzena before insert or update on public.cafe_dias
  for each row execute function public.bloquear_quinzena_fechada();
create trigger cafe_ajustes_quinzena before insert or update on public.cafe_ajustes
  for each row execute function public.bloquear_quinzena_fechada();
create trigger consumos_quarto_quinzena before insert or update on public.consumos_quarto
  for each row execute function public.bloquear_quinzena_fechada();

revoke execute on function public.controlar_bordero(), public.carimbar_conferencia(), public.controlar_quinzena(),
  public.bloquear_quinzena_fechada() from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Regras (vazias: o administrador preenche na tela Café → Regras) e permissões
-------------------------------------------------------------------------------
insert into public.configuracoes (chave, valor, descricao) values
  ('cafe_regras', '{"valor_cafe": 0, "percentual_garantido": 0}',
   'Contrato do café com o hotel: valor por café e percentual de café garantido sobre os hóspedes.'),
  ('cafe_itens_bordero', '[]', 'Itens e preços sugeridos no borderô (consumo na conta do quarto).'),
  ('cafe_precos_venda', '[]', 'Preços sugeridos para cafés pagos na hora (extras, passantes, mensalistas).'),
  ('cafe_autorizadores', '[]', 'Nomes sugeridos em "liberado por" nos ajustes do café.')
on conflict (chave) do nothing;

insert into public.permissoes (papel, modulo, acao) values
  ('financeiro', 'cafes', 'aprovar')
on conflict do nothing;
