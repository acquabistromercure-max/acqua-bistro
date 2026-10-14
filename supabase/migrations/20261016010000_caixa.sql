-- CAIXA (igual à planilha da operação): vendas do dia por forma/bandeira, conta assinada, entradas e saídas de
-- dinheiro com responsável e motivo, fundo de despesas e conferência do dinheiro no fechamento.
-- Saída para colaborador (vale, adiantamento, passagem, diária, pagamento) gera UM lançamento na ficha dele.
-- Taxas de cartão, prazos e saldo inicial ficam em "configuracoes" (tela Caixa → Regras), não no código.

alter type public.tipo_lancamento_colaborador add value if not exists 'passagem';
alter type public.tipo_lancamento_colaborador add value if not exists 'comissao';

-- Permite que gatilhos internos do sistema ajustem registros ligados (ex.: cancelar o vale quando a retirada do
-- caixa é cancelada) sem exigir que a pessoa tenha permissão no módulo de destino.
create or replace function public.controlar_situacao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_modulo text := tg_argv[0];
begin
  if current_setting('acqua.sistema', true) = 'on' then
    return new;
  end if;
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

-------------------------------------------------------------------------------
-- Dia do caixa: vendas por forma de recebimento (sem os cafés, que vêm do módulo Café) + conferência
-------------------------------------------------------------------------------
create table public.caixa_dias (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  vendas jsonb not null default '{}'::jsonb,
  saldo_contado numeric(12, 2),
  observacao text,
  fechado boolean not null default false,
  fechado_por uuid references public.perfis (id),
  fechado_em timestamptz,
  diferenca numeric(12, 2),
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint vendas_objeto check (jsonb_typeof(vendas) = 'object')
);

alter table public.caixa_dias enable row level security;

create policy "ver caixa" on public.caixa_dias for select to authenticated
  using ((select privado.pode('caixa', 'ver')));
create policy "lancar caixa" on public.caixa_dias for insert to authenticated
  with check ((select privado.pode('caixa', 'criar')) and not fechado);
create policy "alterar caixa" on public.caixa_dias for update to authenticated
  using ((select privado.pode('caixa', 'criar')) or (select privado.pode('caixa', 'editar')) or (select privado.pode('caixa', 'aprovar')));
create policy "excluir caixa" on public.caixa_dias for delete to authenticated
  using ((select privado.pode('caixa', 'excluir')));

-- Dia fechado só muda (ou reabre) com "aprovar". Fechar carimba quem e quando.
create function public.controlar_caixa_dia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.fechado and not privado.pode('caixa', 'aprovar') then
      raise exception 'Caixa fechado. Peça para reabrir antes de excluir.';
    end if;
    return old;
  end if;
  if old.fechado and not privado.pode('caixa', 'aprovar') then
    raise exception 'Este caixa já foi fechado. Só gerente/financeiro pode reabrir.';
  end if;
  if not privado.pode('caixa', 'editar') and not privado.pode('caixa', 'aprovar') and old.criado_por is distinct from auth.uid() then
    raise exception 'Você só pode alterar o caixa que você lançou.';
  end if;
  if new.fechado and not old.fechado then
    new.fechado_por := auth.uid();
    new.fechado_em := now();
  elsif not new.fechado then
    new.fechado_por := null;
    new.fechado_em := null;
  end if;
  return new;
end;
$$;

create trigger caixa_dias_controle before update or delete on public.caixa_dias
  for each row execute function public.controlar_caixa_dia();
create trigger caixa_dias_atualizado_em before update on public.caixa_dias
  for each row execute function public.tocar_atualizado_em();
create trigger caixa_dias_auditoria after insert or update or delete on public.caixa_dias
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Entradas e saídas de dinheiro (caixa ou fundo de despesas)
-------------------------------------------------------------------------------
create table public.caixa_movimentos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  conta text not null default 'caixa' check (conta in ('caixa', 'fundo')),
  sentido text not null check (sentido in ('entrada', 'saida')),
  categoria text not null check (categoria in (
    'sangria', 'deposito', 'troco', 'compra', 'despesa', 'vale', 'adiantamento', 'passagem', 'diaria', 'pagamento',
    'suprimento', 'aporte', 'devolucao', 'outro'
  )),
  valor numeric(12, 2) not null check (valor > 0),
  motivo text not null check (length(trim(motivo)) > 0),
  responsavel text not null check (length(trim(responsavel)) > 0), -- quem retirou / entregou o dinheiro
  colaborador_id uuid references public.colaboradores (id),
  fornecedor text,
  autorizado_por text,
  observacao text,
  situacao text not null default 'registrado' check (situacao in ('registrado', 'cancelado')),
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint pessoal_com_colaborador check (
    categoria not in ('vale', 'adiantamento', 'passagem', 'diaria', 'pagamento') or colaborador_id is not null
  ),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index caixa_movimentos_data on public.caixa_movimentos (data);
create index caixa_movimentos_colaborador on public.caixa_movimentos (colaborador_id) where colaborador_id is not null;

alter table public.caixa_movimentos enable row level security;

create policy "ver movimentos do caixa" on public.caixa_movimentos for select to authenticated
  using ((select privado.pode('caixa', 'ver')));
create policy "lancar movimento do caixa" on public.caixa_movimentos for insert to authenticated
  with check ((select privado.pode('caixa', 'criar')) and situacao = 'registrado');
create policy "alterar movimento do caixa" on public.caixa_movimentos for update to authenticated
  using ((select privado.pode('caixa', 'editar')) or (select privado.pode('caixa', 'cancelar')));
create policy "excluir movimento do caixa" on public.caixa_movimentos for delete to authenticated
  using ((select privado.pode('caixa', 'excluir')));

-- Movimento de um dia de caixa já fechado não muda (só com "aprovar").
create function public.bloquear_caixa_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.caixa_dias d
    where d.fechado
      and ((tg_op <> 'DELETE' and new.conta = 'caixa' and d.data = new.data)
        or (tg_op <> 'INSERT' and old.conta = 'caixa' and d.data = old.data))
  ) and not privado.pode('caixa', 'aprovar') then
    raise exception 'O caixa deste dia já foi fechado. Peça para reabrir.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger caixa_movimentos_dia_fechado before insert or update or delete on public.caixa_movimentos
  for each row execute function public.bloquear_caixa_fechado();
create trigger caixa_movimentos_situacao before update on public.caixa_movimentos
  for each row execute function public.controlar_situacao('caixa');
create trigger caixa_movimentos_auditoria after insert or update or delete on public.caixa_movimentos
  for each row execute function public.registrar_auditoria();

-- Saída para colaborador → lançamento na ficha (uma vez só, pela origem). Acompanha correção, cancelamento e exclusão.
create function public.sincronizar_movimento_colaborador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoal boolean;
begin
  perform set_config('acqua.sistema', 'on', true);
  if tg_op in ('UPDATE', 'DELETE') then
    -- Saiu de "pessoal", foi cancelado ou excluído: tira o lançamento.
    if tg_op = 'DELETE' then
      delete from public.lancamentos_colaborador where origem_tipo = 'caixa_movimento' and origem_id = old.id;
      perform set_config('acqua.sistema', 'off', true);
      return old;
    end if;
  end if;
  v_pessoal := new.sentido = 'saida' and new.colaborador_id is not null
    and new.categoria in ('vale', 'adiantamento', 'passagem', 'diaria', 'pagamento');
  if not v_pessoal then
    delete from public.lancamentos_colaborador where origem_tipo = 'caixa_movimento' and origem_id = new.id;
  elsif new.situacao = 'cancelado' then
    update public.lancamentos_colaborador
       set situacao = 'cancelado', motivo_cancelamento = 'Retirada do caixa cancelada: ' || coalesce(new.motivo_cancelamento, '')
     where origem_tipo = 'caixa_movimento' and origem_id = new.id and situacao <> 'cancelado';
  else
    insert into public.lancamentos_colaborador
      (colaborador_id, tipo, data, valor, descricao, competencia, situacao, origem_tipo, origem_id, criado_por)
    values (
      new.colaborador_id, new.categoria::public.tipo_lancamento_colaborador, new.data, new.valor,
      'Caixa: ' || new.motivo, to_char(new.data, 'YYYY-MM'), 'pago', 'caixa_movimento', new.id, new.criado_por
    )
    on conflict (origem_tipo, origem_id) do update
      set colaborador_id = excluded.colaborador_id, tipo = excluded.tipo, data = excluded.data, valor = excluded.valor,
          descricao = excluded.descricao, competencia = excluded.competencia;
  end if;
  perform set_config('acqua.sistema', 'off', true);
  return new;
end;
$$;

create trigger caixa_movimentos_colaborador after insert or update or delete on public.caixa_movimentos
  for each row execute function public.sincronizar_movimento_colaborador();

revoke execute on function public.controlar_caixa_dia(), public.bloquear_caixa_fechado(),
  public.sincronizar_movimento_colaborador() from public, anon, authenticated;

-- Nomes das pessoas também para quem lança no caixa (escolher a quem vai o vale), sem abrir a ficha completa.
create or replace function public.pessoas_escala()
returns table (id uuid, nome text, apelido text, funcao text, vinculo public.vinculo_colaborador, situacao public.situacao_colaborador)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.nome, c.apelido, c.funcao, c.vinculo, c.situacao
  from public.colaboradores c
  where privado.pode('escalas', 'ver') or privado.pode('ponto', 'ver') or privado.pode('colaboradores', 'ver')
     or privado.pode('caixa', 'ver')
  order by c.nome;
$$;

-------------------------------------------------------------------------------
-- Regras (vazias: preenchidas pelo administrador) e permissões
-------------------------------------------------------------------------------
insert into public.configuracoes (chave, valor, descricao) values
  ('caixa_taxas', '{}', 'Taxa (%) de cada forma de recebimento (crédito/débito por bandeira).'),
  ('caixa_prazos', '{"credito": 30, "debito": 1}', 'Dias para o dinheiro cair na conta: crédito e débito.'),
  ('caixa_saldo_inicial', '{"data": null, "caixa": 0, "fundo": 0}', 'Saldo em dinheiro no início do controle (caixa e fundo de despesas).')
on conflict (chave) do nothing;

insert into public.permissoes (papel, modulo, acao) values
  ('financeiro', 'caixa', 'cancelar')
on conflict do nothing;
