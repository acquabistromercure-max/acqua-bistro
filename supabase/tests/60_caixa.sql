-- Caixa: dia, movimentos, vínculo automático com a ficha do colaborador e fechamento.

-- RH cria uma pessoa para os testes de vale.
reset role; select teste.como('rh@teste.local'); set role authenticated;
insert into public.colaboradores (nome, funcao) values ('Pessoa Caixa', 'Garçom');

-- Operador lança o caixa do dia e uma retirada de vale para a pessoa.
reset role; select teste.como('operador@teste.local'); set role authenticated;
insert into public.caixa_dias (data, vendas) values ('2026-09-05', '{"credito_visa": 108, "pix": 54, "dinheiro": 100}');
select teste.deve_falhar($$insert into public.caixa_dias (data) values ('2026-09-05')$$, 'um caixa por dia');
select teste.deve_falhar($$insert into public.caixa_movimentos (data, sentido, categoria, valor, motivo, responsavel)
  values ('2026-09-05', 'saida', 'vale', 50, 'vale', 'Carol')$$, 'vale exige colaborador');
-- Operador não vê as fichas, mas escolhe a pessoa pela lista de nomes (pessoas_escala).
select teste.afirmar((select count(*) = 0 from public.colaboradores), 'operador não vê as fichas');
insert into public.caixa_movimentos (data, sentido, categoria, valor, motivo, responsavel, colaborador_id)
  select '2026-09-05', 'saida', 'vale', 50, 'Vale pedido', 'Carol', id from public.pessoas_escala() where nome = 'Pessoa Caixa';
reset role;
select teste.afirmar((select count(*) = 1 from public.lancamentos_colaborador l join public.caixa_movimentos m on m.id = l.origem_id
  where l.origem_tipo = 'caixa_movimento' and l.tipo = 'vale' and l.valor = 50 and l.situacao = 'pago'), 'vale do caixa vai para a ficha');

-- Corrigir o valor no caixa corrige a ficha (financeiro tem "editar" no caixa).
select teste.como('financeiro@teste.local'); set role authenticated;
update public.caixa_movimentos set valor = 60 where categoria = 'vale';
select teste.afirmar((select valor = 60 from public.lancamentos_colaborador where origem_tipo = 'caixa_movimento'), 'correção chega à ficha');

-- Cancelar no caixa cancela na ficha, mesmo sem permissão no financeiro do colaborador.
reset role; select teste.como('gerente@teste.local'); set role authenticated;
update public.caixa_movimentos set situacao = 'cancelado', motivo_cancelamento = 'Lançado errado' where categoria = 'vale';
select teste.afirmar((select situacao = 'cancelado' from public.lancamentos_colaborador where origem_tipo = 'caixa_movimento'), 'cancelamento chega à ficha');

-- Passagem e despesa: só a passagem vira lançamento.
insert into public.caixa_movimentos (data, sentido, categoria, valor, motivo, responsavel, colaborador_id)
  select '2026-09-05', 'saida', 'passagem', 21.6, 'Passagens da semana', 'Carol', id from public.colaboradores where nome = 'Pessoa Caixa';
insert into public.caixa_movimentos (data, sentido, categoria, valor, motivo, responsavel, fornecedor)
  values ('2026-09-05', 'saida', 'despesa', 130, 'Gás 13kg', 'Rômulo', 'Fornecedor de gás');
select teste.afirmar((select count(*) = 1 from public.lancamentos_colaborador where origem_tipo = 'caixa_movimento' and tipo = 'passagem'), 'passagem na ficha');

-- Fechar o dia: operador fecha o próprio caixa; depois não mexe mais. Gerente reabre.
reset role; select teste.como('operador@teste.local'); set role authenticated;
update public.caixa_dias set saldo_contado = 100, diferenca = 0, fechado = true where data = '2026-09-05';
select teste.afirmar((select fechado_por is not null from public.caixa_dias where data = '2026-09-05'), 'fechamento carimbado');
select teste.deve_falhar($$update public.caixa_dias set vendas = '{}' where data = '2026-09-05'$$, 'caixa fechado não muda');
select teste.deve_falhar($$insert into public.caixa_movimentos (data, sentido, categoria, valor, motivo, responsavel)
  values ('2026-09-05', 'saida', 'despesa', 5, 'x', 'y')$$, 'dia fechado não aceita movimento');
insert into public.caixa_movimentos (data, conta, sentido, categoria, valor, motivo, responsavel)
  values ('2026-09-05', 'fundo', 'saida', 'despesa', 5, 'Uber', 'Carol');
reset role; select teste.como('gerente@teste.local'); set role authenticated;
update public.caixa_dias set fechado = false where data = '2026-09-05';
select teste.afirmar((select not fechado from public.caixa_dias where data = '2026-09-05'), 'gerente reabre o caixa');

-- Excluir a passagem remove o lançamento da ficha.
reset role; select teste.como('admin@teste.local'); set role authenticated;
delete from public.caixa_movimentos where categoria = 'passagem';
select teste.afirmar((select count(*) = 0 from public.lancamentos_colaborador where tipo = 'passagem'), 'excluir no caixa tira da ficha');

-- RH e consulta não veem o caixa.
reset role; select teste.como('rh@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.caixa_dias), 'RH não vê o caixa');
reset role;
