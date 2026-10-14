-- Cartão empresa: cadastro seguro, compras parceladas e faturas.

reset role; select teste.como('financeiro@teste.local'); set role authenticated;
select teste.deve_falhar($$insert into public.cartoes (apelido, banco, final, fechamento_dia, vencimento_dia)
  values ('Cartão', 'Banco', '4111111111111111', 5, 12)$$, 'nunca guarda o número completo');
insert into public.cartoes (apelido, banco, final, fechamento_dia, vencimento_dia) values ('Master empresa', 'Banco Exemplo', '0076', 5, 12);
insert into public.compras_cartao (cartao_id, data, estabelecimento, itens, valor_total, parcelas, responsavel)
  select id, '2026-09-01', 'Atacado', 'Comidas e refrigerantes', 300, 3, 'Carol' from public.cartoes;
select teste.deve_falhar($$insert into public.compras_cartao (cartao_id, data, estabelecimento, itens, valor_total, parcelas, responsavel)
  select id, '2026-09-01', 'x', 'y', 10, 30, 'z' from public.cartoes$$, 'até 24 parcelas');
insert into public.faturas_cartao (cartao_id, competencia, valor_calculado, valor_pago, pago_em)
  select id, '2026-10', 100, 100, '2026-10-12' from public.cartoes;
update public.compras_cartao set situacao = 'cancelado', motivo_cancelamento = 'teste';

-- Operador e RH não veem cartões.
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.cartoes), 'operador não vê cartões');
reset role; select teste.como('rh@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.compras_cartao), 'RH não vê compras no cartão');
reset role;
