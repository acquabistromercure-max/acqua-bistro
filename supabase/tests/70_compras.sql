-- Compras: catálogo, lista de pedidos com fluxo e contas a pagar.

-- Gerente cadastra fornecedor e produtos.
reset role; select teste.como('gerente@teste.local'); set role authenticated;
insert into public.fornecedores (nome, categoria, prazo_dias) values ('Laticínios Exemplo', 'Frios', 14);
insert into public.produtos (nome, categoria, unidade, fornecedor_id, preco_referencia)
  select 'Queijo coalho', 'Frios', 'kg', id, 29 from public.fornecedores where nome = 'Laticínios Exemplo';
insert into public.produtos (nome, categoria, unidade) values ('Detergente 5L', 'Limpeza', 'un');
select teste.deve_falhar($$insert into public.produtos (nome, categoria) values ('Queijo coalho', 'Frios')$$, 'produto não duplica na categoria');

-- Operador vê o catálogo mas não cria pedido (só "ver" por padrão); consulta também só vê.
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 2 from public.produtos), 'operador vê o catálogo');
select teste.deve_falhar($$insert into public.pedidos (titulo) values ('x')$$, 'operador sem "criar" não abre pedido');

-- Libera "criar" para o operador (como o admin faria na tela) e ele monta a lista do Rômulo.
reset role; insert into public.permissoes (papel, modulo, acao) values ('operador', 'compras', 'criar') on conflict do nothing;
select teste.como('operador@teste.local'); set role authenticated;
insert into public.pedidos (titulo, categoria) values ('Lista de frios', 'Frios');
insert into public.pedido_itens (pedido_id, produto_id, descricao, quantidade, unidade, preco_estimado)
  select p.id, pr.id, pr.nome, 10, 'kg', 29 from public.pedidos p, public.produtos pr where p.titulo = 'Lista de frios' and pr.nome = 'Queijo coalho';
update public.pedidos set observacao = 'para sexta' where titulo = 'Lista de frios';
select teste.deve_falhar($$update public.pedidos set situacao = 'aprovado' where titulo = 'Lista de frios'$$, 'operador não aprova');

-- Gerente aprova; depois disso o operador não mexe mais nos itens.
reset role; select teste.como('gerente@teste.local'); set role authenticated;
update public.pedidos set situacao = 'aprovado' where titulo = 'Lista de frios';
select teste.afirmar((select aprovado_por is not null from public.pedidos where titulo = 'Lista de frios'), 'aprovação carimbada');
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.deve_falhar($$update public.pedido_itens set quantidade = 99$$, 'item de pedido aprovado não muda pelo operador');
reset role; select teste.como('gerente@teste.local'); set role authenticated;
update public.pedidos set situacao = 'comprado' where titulo = 'Lista de frios';
update public.pedido_itens set preco_real = 28.5, quantidade_recebida = 10;
update public.pedidos set situacao = 'recebido' where titulo = 'Lista de frios';
select teste.afirmar((select recebido_em is not null from public.pedidos where titulo = 'Lista de frios'), 'recebimento com data');

-- Financeiro lança a conta do boleto e paga.
reset role; select teste.como('financeiro@teste.local'); set role authenticated;
insert into public.contas_pagar (descricao, fornecedor_id, categoria, valor, vencimento, forma, pedido_id)
  select 'Boleto frios', f.id, 'Insumos', 285, '2026-10-20', 'boleto', p.id
  from public.fornecedores f, public.pedidos p where f.nome = 'Laticínios Exemplo' and p.titulo = 'Lista de frios';
select teste.deve_falhar($$insert into public.contas_pagar (descricao, valor, vencimento, situacao) values ('x', 1, '2026-10-20', 'paga')$$,
  'conta nasce aberta');
select teste.deve_falhar($$update public.contas_pagar set situacao = 'paga'$$, 'paga exige data e valor');
update public.contas_pagar set situacao = 'paga', pago_em = '2026-10-19', valor_pago = 285;
select teste.afirmar((select pago_por is not null from public.contas_pagar), 'pagamento carimbado');

-- RH não vê compras nem contas.
reset role; select teste.como('rh@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.contas_pagar), 'RH não vê contas a pagar');
select teste.afirmar((select count(*) = 0 from public.pedidos), 'RH não vê pedidos');
reset role;
