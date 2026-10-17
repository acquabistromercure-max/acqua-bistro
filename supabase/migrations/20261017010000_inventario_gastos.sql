-- INVENTÁRIO + OBRA, MANUTENÇÃO E INVESTIMENTOS (pedido do dono em 17/10/2026).
-- Inventário: itens com quantidade calculada pelos movimentos (nunca digitada), quebras/perdas ligadas a ocorrências,
-- contagens periódicas que comparam o contado com o esperado e acusam diferença sem ocorrência registrada.
-- Gastos (obra, manutenção, investimento): cada gasto diz como foi pago e gera UM registro no lugar certo (caixa,
-- fundo, cartão ou contas a pagar); investimento com item entra sozinho no inventário.

alter type public.tipo_ocorrencia add value if not exists 'quebra';

-------------------------------------------------------------------------------
-- Itens do inventário
-------------------------------------------------------------------------------
create table public.inventario_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  categoria text not null default 'Utensílios',
  local text,
  unidade text not null default 'un',
  quantidade numeric(12, 2) not null default 0, -- soma dos movimentos válidos (mantida pelo sistema)
  estoque_minimo numeric(12, 2) check (estoque_minimo is null or estoque_minimo >= 0),
  valor_unitario numeric(12, 2) check (valor_unitario is null or valor_unitario >= 0),
  patrimonio text,
  equipamento boolean not null default false, -- aparece na Manutenção
  observacao text,
  ativo boolean not null default true,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now()
);

create index inventario_itens_nome on public.inventario_itens (categoria, nome);

alter table public.inventario_itens enable row level security;
create policy "ver inventario" on public.inventario_itens for select to authenticated
  using ((select privado.pode('inventario', 'ver')));
create policy "criar item do inventario" on public.inventario_itens for insert to authenticated
  with check ((select privado.pode('inventario', 'criar')));
create policy "editar item do inventario" on public.inventario_itens for update to authenticated
  using ((select privado.pode('inventario', 'editar')));
create policy "excluir item do inventario" on public.inventario_itens for delete to authenticated
  using ((select privado.pode('inventario', 'excluir')));

-- A quantidade só muda pelos movimentos.
create function public.proteger_quantidade_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('acqua.sistema', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.quantidade := 0;
  elsif new.quantidade is distinct from old.quantidade then
    raise exception 'A quantidade muda só por movimentos (compra, quebra, entrada/saída ou contagem).';
  end if;
  return new;
end;
$$;

create trigger inventario_itens_quantidade before insert or update on public.inventario_itens
  for each row execute function public.proteger_quantidade_item();
create trigger inventario_itens_auditoria after insert or update or delete on public.inventario_itens
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- Contagens (inventário periódico)
-------------------------------------------------------------------------------
create table public.inventario_contagens (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  titulo text not null check (length(trim(titulo)) > 0),
  situacao text not null default 'aberta' check (situacao in ('aberta', 'fechada')),
  observacao text,
  fechada_por uuid references public.perfis (id),
  fechada_em timestamptz,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now()
);

-- Uma contagem aberta por vez.
create unique index inventario_uma_contagem_aberta on public.inventario_contagens ((true)) where situacao = 'aberta';

alter table public.inventario_contagens enable row level security;
create policy "ver contagens" on public.inventario_contagens for select to authenticated
  using ((select privado.pode('inventario', 'ver')));
create policy "abrir contagem" on public.inventario_contagens for insert to authenticated
  with check ((select privado.pode('inventario', 'criar')) and situacao = 'aberta');
create policy "editar contagem aberta" on public.inventario_contagens for update to authenticated
  using ((select privado.pode('inventario', 'criar')) and situacao = 'aberta');
create policy "excluir contagem aberta" on public.inventario_contagens for delete to authenticated
  using ((select privado.pode('inventario', 'excluir')) and situacao = 'aberta');

create function public.controlar_contagem()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('acqua.sistema', true) = 'on' then return new; end if;
  if new.situacao is distinct from old.situacao then
    raise exception 'Use os botões Fechar/Reabrir inventário.';
  end if;
  return new;
end;
$$;

create trigger inventario_contagens_controle before update on public.inventario_contagens
  for each row execute function public.controlar_contagem();
create trigger inventario_contagens_auditoria after insert or update or delete on public.inventario_contagens
  for each row execute function public.registrar_auditoria();

create table public.inventario_contagem_itens (
  id uuid primary key default gen_random_uuid(),
  contagem_id uuid not null references public.inventario_contagens (id) on delete cascade,
  item_id uuid not null references public.inventario_itens (id) on delete cascade,
  contado numeric(12, 2) not null check (contado >= 0),
  esperado numeric(12, 2), -- preenchido ao fechar
  observacao text,
  contado_por uuid default auth.uid() references public.perfis (id),
  unique (contagem_id, item_id)
);

alter table public.inventario_contagem_itens enable row level security;
create policy "ver itens contados" on public.inventario_contagem_itens for select to authenticated
  using ((select privado.pode('inventario', 'ver')));
create policy "contar item" on public.inventario_contagem_itens for insert to authenticated
  with check ((select privado.pode('inventario', 'criar'))
    and exists (select 1 from public.inventario_contagens c where c.id = contagem_id and c.situacao = 'aberta'));
create policy "corrigir item contado" on public.inventario_contagem_itens for update to authenticated
  using ((select privado.pode('inventario', 'criar'))
    and exists (select 1 from public.inventario_contagens c where c.id = contagem_id and c.situacao = 'aberta'));
create policy "tirar item contado" on public.inventario_contagem_itens for delete to authenticated
  using ((select privado.pode('inventario', 'criar'))
    and exists (select 1 from public.inventario_contagens c where c.id = contagem_id and c.situacao = 'aberta'));

-------------------------------------------------------------------------------
-- Gastos: obra (reforma), manutenção e investimentos
-------------------------------------------------------------------------------
create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('obra', 'manutencao', 'investimento')),
  data date not null,
  descricao text not null check (length(trim(descricao)) > 0),
  projeto text,                       -- obra: nome da reforma (ex.: "Reforma do salão")
  categoria text not null default 'Serviço',
  fornecedor_id uuid references public.fornecedores (id),
  prestador text,                     -- quem fez o serviço, quando não é fornecedor cadastrado
  valor numeric(12, 2) not null check (valor > 0),
  pagamento text not null check (pagamento in ('pago', 'caixa', 'fundo', 'cartao', 'a_pagar')),
  forma text,                         -- pago/a pagar: pix, transferência, boleto...
  cartao_id uuid references public.cartoes (id),
  parcelas int not null default 1 check (parcelas between 1 and 48),
  vencimento date,
  responsavel text,                   -- quem pagou / retirou o dinheiro
  item_id uuid references public.inventario_itens (id), -- equipamento (manutenção) ou item comprado; item com gasto não se exclui (desative)
  quantidade numeric(12, 2) check (quantidade is null or quantidade > 0),   -- investimento: quantas unidades entram
  proxima_manutencao date,
  anexo text,                         -- nota/foto no bucket privado "gastos"
  observacao text,
  situacao text not null default 'registrado' check (situacao in ('registrado', 'cancelado')),
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint pagamento_com_responsavel check (pagamento not in ('caixa', 'fundo', 'cartao') or length(trim(coalesce(responsavel, ''))) > 0),
  constraint cartao_informado check (pagamento <> 'cartao' or cartao_id is not null),
  constraint a_pagar_com_vencimento check (pagamento <> 'a_pagar' or vencimento is not null),
  constraint parcelas_so_cartao_ou_conta check (parcelas = 1 or pagamento in ('cartao', 'a_pagar')),
  constraint parcelas_cartao check (pagamento <> 'cartao' or parcelas <= 24),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index gastos_tipo_data on public.gastos (tipo, data desc);
create index gastos_item on public.gastos (item_id) where item_id is not null;

alter table public.gastos enable row level security;
create policy "ver gastos" on public.gastos for select to authenticated using ((select privado.pode('gastos', 'ver')));
create policy "lancar gasto" on public.gastos for insert to authenticated
  with check ((select privado.pode('gastos', 'criar')) and situacao = 'registrado');
create policy "alterar gasto" on public.gastos for update to authenticated
  using ((select privado.pode('gastos', 'editar')) or (select privado.pode('gastos', 'cancelar')));
create policy "excluir gasto" on public.gastos for delete to authenticated using ((select privado.pode('gastos', 'excluir')));

-- Registros gerados por um gasto (um gasto → um lugar só). Excluir o gasto exclui o que ele gerou.
alter table public.caixa_movimentos add column gasto_id uuid references public.gastos (id) on delete cascade;
alter table public.compras_cartao add column gasto_id uuid references public.gastos (id) on delete cascade;
alter table public.contas_pagar add column gasto_id uuid references public.gastos (id) on delete cascade;
create index caixa_movimentos_gasto on public.caixa_movimentos (gasto_id) where gasto_id is not null;
create index compras_cartao_gasto on public.compras_cartao (gasto_id) where gasto_id is not null;
create index contas_pagar_gasto on public.contas_pagar (gasto_id) where gasto_id is not null;

-------------------------------------------------------------------------------
-- Movimentos do inventário (histórico de cada item)
-------------------------------------------------------------------------------
create table public.inventario_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventario_itens (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('inicial', 'compra', 'entrada', 'quebra', 'perda', 'furto', 'descarte', 'saida', 'ajuste')),
  quantidade numeric(12, 2) not null check (quantidade <> 0), -- positiva = entrou; negativa = saiu
  motivo text,
  responsavel_tipo text check (responsavel_tipo in ('colaborador', 'cliente', 'nao_identificado')),
  colaborador_id uuid references public.colaboradores (id),
  ocorrencia_id uuid references public.ocorrencias (id) on delete cascade,
  gasto_id uuid unique references public.gastos (id) on delete cascade,
  contagem_id uuid references public.inventario_contagens (id) on delete cascade,
  situacao text not null default 'registrado' check (situacao in ('registrado', 'cancelado')),
  motivo_cancelamento text,
  aprovado_por uuid references public.perfis (id),
  aprovado_em timestamptz,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint sinal_por_tipo check (
    (tipo in ('inicial', 'compra', 'entrada') and quantidade > 0)
    or (tipo in ('quebra', 'perda', 'furto', 'descarte', 'saida') and quantidade < 0)
    or tipo = 'ajuste'
  ),
  constraint perda_com_responsavel check (tipo not in ('quebra', 'perda', 'furto', 'descarte') or responsavel_tipo is not null),
  constraint colaborador_informado check (responsavel_tipo is distinct from 'colaborador' or colaborador_id is not null),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index inventario_movimentos_item on public.inventario_movimentos (item_id, data);
create index inventario_movimentos_data on public.inventario_movimentos (data);

alter table public.inventario_movimentos enable row level security;
create policy "ver movimentos do inventario" on public.inventario_movimentos for select to authenticated
  using ((select privado.pode('inventario', 'ver')));
-- Pela tela só entram saldo inicial, entrada e saída avulsas. Quebras: registrar_quebra(); compras: pelo gasto;
-- ajustes: fechar_contagem().
create policy "lancar movimento do inventario" on public.inventario_movimentos for insert to authenticated
  with check ((select privado.pode('inventario', 'editar')) and situacao = 'registrado' and tipo in ('inicial', 'entrada', 'saida')
    and gasto_id is null and contagem_id is null and ocorrencia_id is null);
create policy "alterar movimento do inventario" on public.inventario_movimentos for update to authenticated
  using ((select privado.pode('inventario', 'editar')) or (select privado.pode('inventario', 'cancelar')));
create policy "excluir movimento do inventario" on public.inventario_movimentos for delete to authenticated
  using ((select privado.pode('inventario', 'excluir')));

-- Período já inventariado não muda: nada com data até a última contagem fechada (só o fechamento grava ajustes).
create function public.bloquear_periodo_inventariado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ultima date := (select max(data) from public.inventario_contagens where situacao = 'fechada');
  v_data date;
begin
  if tg_op = 'DELETE' then
    v_data := old.data;
  elsif tg_op = 'INSERT' then
    v_data := new.data;
  else
    v_data := least(new.data, old.data);
    if current_setting('acqua.sistema', true) is distinct from 'on'
       and (new.item_id, new.tipo, new.quantidade, new.data) is distinct from (old.item_id, old.tipo, old.quantidade, old.data) then
      raise exception 'Movimento não se edita: cancele (com motivo) e lance de novo.';
    end if;
  end if;
  if v_ultima is not null and v_data <= v_ultima and current_setting('acqua.fechando_contagem', true) is distinct from 'on' then
    raise exception 'Este período já foi inventariado (contagem de %). Lance com data depois dela.', to_char(v_ultima, 'DD/MM/YYYY');
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Recalcula a quantidade do item.
create function public.recalcular_item_inventario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior text := coalesce(current_setting('acqua.sistema', true), 'off');
  v_itens uuid[];
begin
  if tg_op = 'INSERT' then v_itens := array[new.item_id];
  elsif tg_op = 'DELETE' then v_itens := array[old.item_id];
  else v_itens := array[new.item_id, old.item_id];
  end if;
  perform set_config('acqua.sistema', 'on', true);
  update public.inventario_itens i
     set quantidade = coalesce((select sum(m.quantidade) from public.inventario_movimentos m
                                where m.item_id = i.id and m.situacao = 'registrado'), 0)
   where i.id = any (v_itens);
  perform set_config('acqua.sistema', v_anterior, true);
  return null;
end;
$$;

-- Quebra cancelada/excluída → ocorrência do colaborador acompanha.
create function public.sincronizar_movimento_ocorrencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior text := coalesce(current_setting('acqua.sistema', true), 'off');
begin
  if tg_op = 'DELETE' then
    if old.ocorrencia_id is not null then
      delete from public.ocorrencias where id = old.ocorrencia_id;
    end if;
    return old;
  end if;
  if new.ocorrencia_id is not null and new.situacao = 'cancelado' and old.situacao <> 'cancelado' then
    perform set_config('acqua.sistema', 'on', true);
    update public.ocorrencias set situacao = 'cancelada', motivo_cancelamento = coalesce(new.motivo_cancelamento, 'Quebra cancelada')
     where id = new.ocorrencia_id and situacao <> 'cancelada';
    perform set_config('acqua.sistema', v_anterior, true);
  end if;
  return new;
end;
$$;

create trigger inventario_movimentos_periodo before insert or update or delete on public.inventario_movimentos
  for each row execute function public.bloquear_periodo_inventariado();
create trigger inventario_movimentos_situacao before update on public.inventario_movimentos
  for each row execute function public.controlar_situacao('inventario');
create trigger inventario_movimentos_quantidade after insert or update or delete on public.inventario_movimentos
  for each row execute function public.recalcular_item_inventario();
create trigger inventario_movimentos_ocorrencia after update or delete on public.inventario_movimentos
  for each row execute function public.sincronizar_movimento_ocorrencia();
create trigger inventario_movimentos_auditoria after insert or update or delete on public.inventario_movimentos
  for each row execute function public.registrar_auditoria();

-- Ocorrência de quebra cancelada na ficha → a baixa no inventário é cancelada também.
create function public.sincronizar_ocorrencia_inventario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior text := coalesce(current_setting('acqua.sistema', true), 'off');
begin
  if new.situacao::text = 'cancelada' and old.situacao::text <> 'cancelada' then
    perform set_config('acqua.sistema', 'on', true);
    update public.inventario_movimentos set situacao = 'cancelado',
           motivo_cancelamento = 'Ocorrência cancelada: ' || coalesce(new.motivo_cancelamento, '')
     where ocorrencia_id = new.id and situacao = 'registrado';
    perform set_config('acqua.sistema', v_anterior, true);
  end if;
  return new;
end;
$$;

create trigger ocorrencias_inventario after update on public.ocorrencias
  for each row execute function public.sincronizar_ocorrencia_inventario();

-------------------------------------------------------------------------------
-- Registrar quebra/perda (gerente e administrador): baixa o inventário e, se foi um colaborador, cria a ocorrência
-- na ficha dele (já aprovada; desconto só se alguém gerar na ocorrência).
-------------------------------------------------------------------------------
create function public.registrar_quebra(
  p_item uuid,
  p_quantidade numeric,
  p_tipo text,
  p_data date,
  p_responsavel_tipo text,
  p_colaborador uuid,
  p_descricao text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventario_itens;
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
  select * into v_item from public.inventario_itens where id = p_item;
  if v_item.id is null then raise exception 'Item não encontrado.'; end if;
  if p_responsavel_tipo = 'colaborador' then
    if p_colaborador is null then raise exception 'Escolha o colaborador.'; end if;
    insert into public.ocorrencias (colaborador_id, tipo, data, descricao, situacao, aprovado_por, aprovado_em, criado_por)
    values (p_colaborador, 'quebra', p_data,
            v_rotulo || ' de ' || trim(to_char(p_quantidade, 'FM999999990.##')) || ' ' || v_item.unidade || ' de ' || v_item.nome
              || ' (inventário): ' || trim(p_descricao),
            'aprovada', auth.uid(), now(), auth.uid())
    returning id into v_ocorrencia;
  end if;
  insert into public.inventario_movimentos
    (item_id, data, tipo, quantidade, motivo, responsavel_tipo, colaborador_id, ocorrencia_id, aprovado_por, aprovado_em)
  values (p_item, p_data, p_tipo, -p_quantidade, trim(p_descricao), p_responsavel_tipo,
          case when p_responsavel_tipo = 'colaborador' then p_colaborador end, v_ocorrencia, auth.uid(), now())
  returning id into v_id;
  return v_id;
end;
$$;

-------------------------------------------------------------------------------
-- Fechar / reabrir inventário
-------------------------------------------------------------------------------
create function public.fechar_contagem(p_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.inventario_contagens;
  v_l record;
  v_diferencas int := 0;
begin
  if not privado.pode('inventario', 'aprovar') then
    raise exception 'Só gerente ou administrador fecha o inventário.';
  end if;
  select * into v_c from public.inventario_contagens where id = p_id for update;
  if v_c.id is null or v_c.situacao <> 'aberta' then raise exception 'Esta contagem não está aberta.'; end if;
  if exists (select 1 from public.inventario_contagens where situacao = 'fechada' and data >= v_c.data) then
    raise exception 'Já existe inventário fechado nesta data ou depois.';
  end if;
  if not exists (select 1 from public.inventario_contagem_itens where contagem_id = p_id) then
    raise exception 'Nenhum item foi contado.';
  end if;
  perform set_config('acqua.fechando_contagem', 'on', true);
  for v_l in
    select ci.id, ci.item_id, ci.contado,
           coalesce((select sum(m.quantidade) from public.inventario_movimentos m
                     where m.item_id = ci.item_id and m.situacao = 'registrado' and m.data <= v_c.data), 0) as esperado
    from public.inventario_contagem_itens ci where ci.contagem_id = p_id
  loop
    update public.inventario_contagem_itens set esperado = v_l.esperado where id = v_l.id;
    if v_l.contado <> v_l.esperado then
      insert into public.inventario_movimentos (item_id, data, tipo, quantidade, motivo, contagem_id, aprovado_por, aprovado_em)
      values (v_l.item_id, v_c.data, 'ajuste', v_l.contado - v_l.esperado,
              'Diferença na contagem "' || v_c.titulo || '" sem ocorrência registrada', p_id, auth.uid(), now());
      v_diferencas := v_diferencas + 1;
    end if;
  end loop;
  perform set_config('acqua.sistema', 'on', true);
  update public.inventario_contagens set situacao = 'fechada', fechada_por = auth.uid(), fechada_em = now() where id = p_id;
  perform set_config('acqua.sistema', 'off', true);
  perform set_config('acqua.fechando_contagem', 'off', true);
  return v_diferencas;
end;
$$;

-- Reabrir só a última contagem fechada: desfaz os ajustes dela.
create function public.reabrir_contagem(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.inventario_contagens;
begin
  if not privado.pode('inventario', 'aprovar') then
    raise exception 'Só gerente ou administrador reabre o inventário.';
  end if;
  select * into v_c from public.inventario_contagens where id = p_id for update;
  if v_c.id is null or v_c.situacao <> 'fechada' then raise exception 'Esta contagem não está fechada.'; end if;
  if exists (select 1 from public.inventario_contagens where situacao = 'aberta') then
    raise exception 'Já existe uma contagem aberta. Feche ou exclua antes.';
  end if;
  if exists (select 1 from public.inventario_contagens where situacao = 'fechada' and data > v_c.data) then
    raise exception 'Só dá para reabrir o último inventário fechado.';
  end if;
  perform set_config('acqua.sistema', 'on', true);
  perform set_config('acqua.fechando_contagem', 'on', true);
  delete from public.inventario_movimentos where contagem_id = p_id;
  update public.inventario_contagem_itens set esperado = null where contagem_id = p_id;
  update public.inventario_contagens set situacao = 'aberta', fechada_por = null, fechada_em = null where id = p_id;
  perform set_config('acqua.fechando_contagem', 'off', true);
  perform set_config('acqua.sistema', 'off', true);
end;
$$;

-------------------------------------------------------------------------------
-- Gasto → caixa / fundo / cartão / conta a pagar / inventário
-------------------------------------------------------------------------------
create function public.controlar_gasto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'cancelado' then raise exception 'Gasto cancelado não pode ser alterado.'; end if;
  if new.situacao = 'cancelado' and not privado.pode('gastos', 'cancelar') then
    raise exception 'Você não tem permissão para cancelar.';
  end if;
  if new.situacao = 'registrado' and not privado.pode('gastos', 'editar') then
    raise exception 'Você não tem permissão para editar.';
  end if;
  if (new.pagamento, new.cartao_id, new.parcelas, new.vencimento, new.tipo)
     is distinct from (old.pagamento, old.cartao_id, old.parcelas, old.vencimento, old.tipo) then
    raise exception 'Para mudar a forma de pagamento, as parcelas ou o tipo, exclua o gasto e lance de novo.';
  end if;
  return new;
end;
$$;

create function public.rotulo_gasto(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo when 'obra' then 'Obra' when 'manutencao' then 'Manutenção' else 'Investimento' end;
$$;

create function public.sincronizar_gasto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rotulo text := public.rotulo_gasto(new.tipo);
  v_texto text := public.rotulo_gasto(new.tipo) || ': ' || new.descricao;
  v_quem text := coalesce((select f.nome from public.fornecedores f where f.id = new.fornecedor_id), nullif(trim(new.prestador), ''), new.descricao);
  v_parcela numeric(12, 2);
  v_primeira numeric(12, 2);
  v_ultima_contagem date;
  v_anterior text := coalesce(current_setting('acqua.sistema', true), 'off');
  i int;
begin
  perform set_config('acqua.sistema', 'on', true);

  if new.situacao = 'cancelado' then
    if tg_op = 'UPDATE' and old.situacao <> 'cancelado' then
      if exists (select 1 from public.contas_pagar where gasto_id = new.id and situacao = 'paga') then
        raise exception 'Há conta a pagar deste gasto já paga. Desfaça o pagamento antes de cancelar.';
      end if;
      perform set_config('acqua.sistema', 'on', true);
      update public.caixa_movimentos set situacao = 'cancelado', motivo_cancelamento = 'Gasto cancelado: ' || new.motivo_cancelamento
       where gasto_id = new.id and situacao <> 'cancelado';
      perform set_config('acqua.sistema', 'on', true);
      update public.compras_cartao set situacao = 'cancelado', motivo_cancelamento = 'Gasto cancelado: ' || new.motivo_cancelamento
       where gasto_id = new.id and situacao <> 'cancelado';
      perform set_config('acqua.sistema', 'on', true);
      update public.contas_pagar set situacao = 'cancelada', motivo_cancelamento = 'Gasto cancelado: ' || new.motivo_cancelamento
       where gasto_id = new.id and situacao = 'aberta';
      perform set_config('acqua.sistema', 'on', true);
      update public.inventario_movimentos set situacao = 'cancelado', motivo_cancelamento = 'Gasto cancelado: ' || new.motivo_cancelamento
       where gasto_id = new.id and situacao = 'registrado';
    end if;
    perform set_config('acqua.sistema', v_anterior, true);
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.pagamento in ('caixa', 'fundo') then
      perform set_config('acqua.sistema', 'on', true);
      insert into public.caixa_movimentos (data, conta, sentido, categoria, valor, motivo, responsavel, fornecedor, observacao, gasto_id, criado_por)
      values (new.data, new.pagamento, 'saida', case when new.tipo = 'investimento' then 'compra' else 'despesa' end,
              new.valor, v_texto, new.responsavel, v_quem, new.observacao, new.id, new.criado_por);
    elsif new.pagamento = 'cartao' then
      perform set_config('acqua.sistema', 'on', true);
      insert into public.compras_cartao (cartao_id, data, estabelecimento, fornecedor_id, itens, categoria, valor_total, parcelas, responsavel, observacao, gasto_id, criado_por)
      values (new.cartao_id, new.data, v_quem, new.fornecedor_id, v_texto, v_rotulo, new.valor, new.parcelas, new.responsavel, new.observacao, new.id, new.criado_por);
    elsif new.pagamento = 'a_pagar' then
      -- Parcelas mensais no mesmo dia; os centavos de diferença ficam na primeira.
      v_parcela := floor(new.valor / new.parcelas * 100) / 100;
      v_primeira := new.valor - v_parcela * (new.parcelas - 1);
      for i in 0 .. new.parcelas - 1 loop
        perform set_config('acqua.sistema', 'on', true);
        insert into public.contas_pagar (descricao, fornecedor_id, categoria, valor, data_compra, vencimento, forma, parcela, observacao, gasto_id, criado_por)
        values (v_texto, new.fornecedor_id, v_rotulo, case when i = 0 then v_primeira else v_parcela end, new.data,
                (new.vencimento + make_interval(months => i))::date,
                case when new.forma in ('boleto', 'pix', 'dinheiro', 'transferencia', 'cartao', 'debito_automatico') then new.forma else 'outro' end,
                case when new.parcelas > 1 then (i + 1) || '/' || new.parcelas end, new.observacao, new.id, new.criado_por);
      end loop;
    end if;
  else
    -- Correções (valor, data, descrição) acompanham no registro gerado.
    perform set_config('acqua.sistema', 'on', true);
    update public.caixa_movimentos set data = new.data, valor = new.valor, motivo = v_texto, responsavel = new.responsavel, fornecedor = v_quem
     where gasto_id = new.id and (data, valor, motivo, responsavel, fornecedor) is distinct from (new.data, new.valor, v_texto, new.responsavel, v_quem);
    perform set_config('acqua.sistema', 'on', true);
    update public.compras_cartao set data = new.data, valor_total = new.valor, itens = v_texto, estabelecimento = v_quem,
           fornecedor_id = new.fornecedor_id, responsavel = new.responsavel
     where gasto_id = new.id and (data, valor_total, itens, estabelecimento, fornecedor_id, responsavel)
           is distinct from (new.data, new.valor, v_texto, v_quem, new.fornecedor_id, new.responsavel);
    if new.pagamento = 'a_pagar' then
      if new.valor <> old.valor then
        if new.parcelas > 1 or exists (select 1 from public.contas_pagar where gasto_id = new.id and situacao <> 'aberta') then
          raise exception 'O valor deste gasto já virou conta parcelada ou paga. Exclua o gasto e lance de novo.';
        end if;
      end if;
      perform set_config('acqua.sistema', 'on', true);
      update public.contas_pagar set valor = case when new.parcelas = 1 then new.valor else valor end, descricao = v_texto,
             fornecedor_id = new.fornecedor_id, data_compra = new.data
       where gasto_id = new.id and situacao = 'aberta';
    end if;
  end if;

  -- Investimento com item: entra no inventário (depois do último inventário fechado, se a compra for de antes).
  if new.tipo = 'investimento' and new.item_id is not null and coalesce(new.quantidade, 0) > 0 then
    v_ultima_contagem := (select max(data) from public.inventario_contagens where situacao = 'fechada');
    if tg_op = 'UPDATE' and exists (select 1 from public.inventario_movimentos where gasto_id = new.id) then
      if old.item_id is distinct from new.item_id or old.quantidade is distinct from new.quantidade then
        perform set_config('acqua.sistema', 'on', true);
        delete from public.inventario_movimentos where gasto_id = new.id;
      end if;
    end if;
    if not exists (select 1 from public.inventario_movimentos where gasto_id = new.id) then
      perform set_config('acqua.sistema', 'on', true);
      insert into public.inventario_movimentos (item_id, data, tipo, quantidade, motivo, gasto_id, criado_por)
      values (new.item_id, greatest(new.data, coalesce(v_ultima_contagem + 1, new.data)), 'compra', new.quantidade,
              'Investimento: ' || new.descricao, new.id, new.criado_por);
    end if;
  elsif tg_op = 'UPDATE' then
    perform set_config('acqua.sistema', 'on', true);
    delete from public.inventario_movimentos where gasto_id = new.id;
  end if;

  perform set_config('acqua.sistema', v_anterior, true);
  return new;
end;
$$;

create trigger gastos_controle before update on public.gastos for each row execute function public.controlar_gasto();
create trigger gastos_sincronizar after insert or update on public.gastos for each row execute function public.sincronizar_gasto();
create trigger gastos_auditoria after insert or update or delete on public.gastos
  for each row execute function public.registrar_auditoria();

-- Registros gerados por gasto: o sistema pode cancelar a conta sem exigir a permissão "contas" de quem cancela o gasto.
create or replace function public.controlar_conta_pagar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('acqua.sistema', true) = 'on' then return new; end if;
  if old.situacao = 'cancelada' then raise exception 'Conta cancelada não pode ser alterada.'; end if;
  if new.situacao = 'cancelada' and old.situacao <> 'cancelada' and not privado.pode('contas', 'cancelar') then
    raise exception 'Você não tem permissão para cancelar contas.';
  end if;
  if new.situacao = 'paga' and old.situacao <> 'paga' then new.pago_por := auth.uid(); end if;
  if new.situacao = 'aberta' then new.pago_por := null; end if;
  return new;
end;
$$;

revoke execute on function public.proteger_quantidade_item(), public.controlar_contagem(), public.bloquear_periodo_inventariado(),
  public.recalcular_item_inventario(), public.sincronizar_movimento_ocorrencia(), public.sincronizar_ocorrencia_inventario(),
  public.controlar_gasto(), public.sincronizar_gasto(), public.controlar_conta_pagar() from public, anon, authenticated;
revoke execute on function public.registrar_quebra(uuid, numeric, text, date, text, uuid, text), public.fechar_contagem(uuid),
  public.reabrir_contagem(uuid) from public, anon;
grant execute on function public.registrar_quebra(uuid, numeric, text, date, text, uuid, text), public.fechar_contagem(uuid),
  public.reabrir_contagem(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Notas e fotos dos gastos (bucket privado)
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gastos', 'gastos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "ver anexos de gastos" on storage.objects for select to authenticated
  using (bucket_id = 'gastos' and (select privado.pode('gastos', 'ver')));
create policy "enviar anexos de gastos" on storage.objects for insert to authenticated
  with check (bucket_id = 'gastos' and ((select privado.pode('gastos', 'criar')) or (select privado.pode('gastos', 'editar'))));
create policy "trocar anexos de gastos" on storage.objects for update to authenticated
  using (bucket_id = 'gastos' and ((select privado.pode('gastos', 'criar')) or (select privado.pode('gastos', 'editar'))));
create policy "apagar anexos de gastos" on storage.objects for delete to authenticated
  using (bucket_id = 'gastos' and ((select privado.pode('gastos', 'editar')) or (select privado.pode('gastos', 'excluir'))));

-------------------------------------------------------------------------------
-- Categorias (editáveis) e permissões padrão
-------------------------------------------------------------------------------
insert into public.configuracoes (chave, valor, descricao) values
  ('inventario_categorias', '["Louças", "Talheres", "Copos e taças", "Utensílios de cozinha", "Panelas", "Equipamentos", "Móveis", "Enxoval", "Decoração", "Outros"]',
   'Categorias dos itens do inventário.'),
  ('inventario_locais', '["Salão", "Cozinha", "Bar", "Estoque", "Escritório", "Área externa"]', 'Locais onde os itens ficam.'),
  ('gastos_categorias', '{"obra": ["Mão de obra", "Material", "Projeto", "Elétrica", "Hidráulica", "Pintura", "Marcenaria", "Outros"], "manutencao": ["Preventiva", "Corretiva", "Peças", "Limpeza técnica", "Outros"], "investimento": ["Equipamento", "Utensílios", "Móveis", "Decoração", "Tecnologia", "Outros"]}',
   'Categorias de obra, manutenção e investimentos.')
on conflict (chave) do nothing;

insert into public.permissoes (papel, modulo, acao) values
  ('gerente', 'inventario', 'ver'), ('gerente', 'inventario', 'criar'), ('gerente', 'inventario', 'editar'),
  ('gerente', 'inventario', 'aprovar'), ('gerente', 'inventario', 'cancelar'), ('gerente', 'inventario', 'exportar'),
  ('financeiro', 'inventario', 'ver'), ('financeiro', 'inventario', 'exportar'),
  ('operador', 'inventario', 'ver'),
  ('consulta', 'inventario', 'ver'),
  ('gerente', 'gastos', 'ver'), ('gerente', 'gastos', 'criar'), ('gerente', 'gastos', 'editar'),
  ('gerente', 'gastos', 'cancelar'), ('gerente', 'gastos', 'exportar'),
  ('financeiro', 'gastos', 'ver'), ('financeiro', 'gastos', 'criar'), ('financeiro', 'gastos', 'editar'),
  ('financeiro', 'gastos', 'cancelar'), ('financeiro', 'gastos', 'exportar')
on conflict do nothing;
