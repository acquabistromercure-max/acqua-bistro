-- Inventário (quebras ligadas a ocorrências, contagem que acusa diferença) e gastos (obra/manutenção/investimento).

reset role; select teste.como('gerente@teste.local'); set role authenticated;
insert into public.inventario_itens (nome, categoria, unidade) values ('Prato raso teste', 'Louças', 'un'), ('Panela 20L teste', 'Panelas', 'un');
select teste.afirmar((select quantidade = 0 from public.inventario_itens where nome = 'Prato raso teste'), 'item nasce com zero');
select teste.deve_falhar($$update public.inventario_itens set quantidade = 99 where nome = 'Prato raso teste'$$, 'quantidade não se digita');

insert into public.inventario_movimentos (item_id, data, tipo, quantidade, motivo)
  select id, '2026-11-01', 'inicial', 50, 'Saldo inicial' from public.inventario_itens where nome = 'Prato raso teste';
select teste.afirmar((select quantidade = 50 from public.inventario_itens where nome = 'Prato raso teste'), 'saldo inicial 50');
select teste.deve_falhar($$insert into public.inventario_movimentos (item_id, data, tipo, quantidade, motivo)
  select id, '2026-11-02', 'quebra', -1, 'x' from public.inventario_itens where nome = 'Prato raso teste'$$, 'quebra só pela função');

-- Quebra por colaborador gera ocorrência aprovada na ficha; quebra de cliente não.
select public.registrar_quebra((select id from public.inventario_itens where nome = 'Prato raso teste'), 10, 'quebra', '2026-11-10',
  'colaborador', (select id from public.colaboradores order by nome limit 1), 'Caiu a pilha de pratos');
select public.registrar_quebra((select id from public.inventario_itens where nome = 'Prato raso teste'), 2, 'quebra', '2026-11-12',
  'cliente', null, 'Mesa 4');
select teste.afirmar((select quantidade = 38 from public.inventario_itens where nome = 'Prato raso teste'), 'quebras baixam: 38');
select teste.afirmar((select count(*) = 1 from public.ocorrencias where tipo = 'quebra' and situacao = 'aprovada' and descricao like '%Prato raso teste%'),
  'ocorrência de quebra na ficha');

-- Ocorrência cancelada na ficha devolve a quantidade.
select public.registrar_quebra((select id from public.inventario_itens where nome = 'Prato raso teste'), 1, 'quebra', '2026-11-13',
  'colaborador', (select id from public.colaboradores order by nome limit 1), 'Trincou');
select teste.afirmar((select quantidade = 37 from public.inventario_itens where nome = 'Prato raso teste'), '37 após a terceira quebra');
reset role; select teste.como('admin@teste.local'); set role authenticated;
update public.ocorrencias set situacao = 'cancelada', motivo_cancelamento = 'Registrada por engano' where descricao like '%Trincou%';
select teste.afirmar((select quantidade = 38 from public.inventario_itens where nome = 'Prato raso teste'), 'cancelar ocorrência devolve: 38');

-- Contagem: contou 35, esperado 38 → diferença de -3 sem ocorrência.
reset role; select teste.como('gerente@teste.local'); set role authenticated;
insert into public.inventario_contagens (data, titulo) values ('2026-11-30', 'Inventário de novembro teste');
select teste.deve_falhar($$insert into public.inventario_contagens (data, titulo) values ('2026-12-01', 'Outra')$$, 'uma contagem aberta por vez');
insert into public.inventario_contagem_itens (contagem_id, item_id, contado)
  select c.id, i.id, 35 from public.inventario_contagens c, public.inventario_itens i
  where c.titulo = 'Inventário de novembro teste' and i.nome = 'Prato raso teste';
select teste.afirmar((select public.fechar_contagem(id) = 1 from public.inventario_contagens where titulo = 'Inventário de novembro teste'), 'uma diferença');
select teste.afirmar((select quantidade = 35 from public.inventario_itens where nome = 'Prato raso teste'), 'quantidade = contado');
select teste.afirmar((select esperado = 38 from public.inventario_contagem_itens), 'esperado guardado');
select teste.afirmar((select count(*) = 1 from public.inventario_movimentos where tipo = 'ajuste' and quantidade = -3), 'ajuste de -3');
select teste.deve_falhar($$insert into public.inventario_movimentos (item_id, data, tipo, quantidade, motivo)
  select id, '2026-11-20', 'entrada', 1, 'x' from public.inventario_itens where nome = 'Prato raso teste'$$, 'período inventariado travado');

-- Reabrir desfaz o ajuste; fechar de novo refaz.
select public.reabrir_contagem(id) from public.inventario_contagens where titulo = 'Inventário de novembro teste';
select teste.afirmar((select quantidade = 38 from public.inventario_itens where nome = 'Prato raso teste'), 'reabrir volta a 38');
select public.fechar_contagem(id) from public.inventario_contagens where titulo = 'Inventário de novembro teste';
select teste.afirmar((select quantidade = 35 from public.inventario_itens where nome = 'Prato raso teste'), 'fechado de novo: 35');

-- Investimento pago no caixa: sai do caixa uma vez e entra no inventário (depois do inventário fechado).
insert into public.gastos (tipo, data, descricao, categoria, valor, pagamento, responsavel, item_id, quantidade)
  select 'investimento', '2026-11-15', 'Panelas grandes', 'Utensílios', 300, 'caixa', 'Carol', id, 2
  from public.inventario_itens where nome = 'Panela 20L teste';
select teste.afirmar((select count(*) = 1 from public.caixa_movimentos m join public.gastos g on g.id = m.gasto_id
  where g.descricao = 'Panelas grandes' and m.valor = 300 and m.categoria = 'compra'), 'saída no caixa');
select teste.afirmar((select quantidade = 2 from public.inventario_itens where nome = 'Panela 20L teste'), 'panelas no inventário');
select teste.afirmar((select data = '2026-12-01' from public.inventario_movimentos where tipo = 'compra'), 'entrada depois do inventário');
select teste.deve_falhar($$update public.gastos set pagamento = 'pago' where descricao = 'Panelas grandes'$$, 'não troca a forma de pagamento');
update public.gastos set situacao = 'cancelado', motivo_cancelamento = 'Devolvidas' where descricao = 'Panelas grandes';
select teste.afirmar((select quantidade = 0 from public.inventario_itens where nome = 'Panela 20L teste'), 'cancelar tira do inventário');
select teste.afirmar((select situacao = 'cancelado' from public.caixa_movimentos where motivo like '%Panelas grandes%'), 'cancelar estorna o caixa');

-- Obra a pagar em 3 vezes vira 3 contas.
insert into public.gastos (tipo, data, descricao, projeto, categoria, valor, pagamento, forma, parcelas, vencimento, prestador)
  values ('obra', '2026-11-20', 'Pintura do salão', 'Reforma do salão', 'Pintura', 1000, 'a_pagar', 'boleto', 3, '2026-12-10', 'João Pintor');
select teste.afirmar((select count(*) = 3 and sum(c.valor) = 1000 and min(c.categoria) = 'Obra' from public.contas_pagar c
  join public.gastos g on g.id = c.gasto_id where g.descricao = 'Pintura do salão'), '3 parcelas de obra');

-- Operador só olha o inventário; RH não vê gastos.
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.afirmar((select count(*) >= 2 from public.inventario_itens), 'operador vê o inventário');
select teste.deve_falhar($$select public.registrar_quebra((select id from public.inventario_itens limit 1), 1, 'quebra', '2026-12-05',
  'cliente', null, 'x')$$, 'operador não registra quebra');
select teste.deve_falhar($$insert into public.inventario_itens (nome) values ('x')$$, 'operador não cria item');
reset role; select teste.como('rh@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.gastos), 'RH não vê gastos');
reset role;
