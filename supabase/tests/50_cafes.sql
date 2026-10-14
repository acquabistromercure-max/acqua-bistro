-- Café e hotel: dia, ajustes, borderô, vendas/mensalistas, fechamento da quinzena e regras.

-- Só o administrador grava as regras do contrato.
reset role; select teste.como('gerente@teste.local'); set role authenticated;
update public.configuracoes set valor = '{"valor_cafe": 10, "percentual_garantido": 70}' where chave = 'cafe_regras';
select teste.afirmar((select valor ->> 'valor_cafe' = '0' from public.configuracoes where chave = 'cafe_regras'), 'gerente não muda regras');
reset role; select teste.como('admin@teste.local'); set role authenticated;
update public.configuracoes set valor = '{"valor_cafe": 10, "percentual_garantido": 70}' where chave = 'cafe_regras';
select teste.afirmar((select valor ->> 'valor_cafe' = '10' from public.configuracoes where chave = 'cafe_regras'), 'admin muda regras');

-- Operador lança o dia, ajustes, borderô e vendas, mas não corrige nem confere.
reset role; select teste.como('operador@teste.local'); set role authenticated;
insert into public.cafe_dias (data, hospedes, cafes_servidos, valor_cafe, percentual_garantido) values ('2026-09-01', 100, 60, 10, 70);
select teste.deve_falhar($$insert into public.cafe_dias (data, hospedes, cafes_servidos, valor_cafe, percentual_garantido)
  values ('2026-09-01', 1, 1, 10, 70)$$, 'um lançamento por dia');
update public.cafe_dias set cafes_servidos = 99;
select teste.afirmar((select cafes_servidos = 60 from public.cafe_dias), 'operador não corrige o dia');

insert into public.cafe_ajustes (data, apartamento, quantidade, valor_unitario, motivo) values ('2026-09-01', '1207', 1, 10, 'fora_da_ventilacao');
insert into public.cafe_ajustes (data, apartamento, quantidade, valor_unitario, motivo) values ('2026-09-01', '1601', -1, 10, 'sem_direito');
select teste.deve_falhar($$insert into public.cafe_ajustes (data, apartamento, quantidade, valor_unitario, motivo)
  values ('2026-09-01', '1007', 2, 10, 'liberado_gestor')$$, 'liberado exige quem autorizou');
select teste.afirmar((select sum(total) = 0 from public.cafe_ajustes), 'ajuste negativo desconta');

insert into public.consumos_quarto (data, apartamento, item, quantidade, valor_unitario) values ('2026-09-01', '604', 'Almoço', 2, 30);
update public.consumos_quarto set entregue_recepcao = true, entregue_a = 'Recepção';
select teste.afirmar((select entregue_em is not null and total = 60 from public.consumos_quarto), 'operador marca entrega no borderô');
select teste.deve_falhar($$update public.consumos_quarto set valor_unitario = 1$$, 'operador não corrige valor do borderô');

insert into public.cafe_vendas (data, cliente, quantidade, valor_total, forma, bandeira, recebido_em)
  values ('2026-09-01', 'Passante', 2, 108, 'credito', 'visa', '2026-09-01');
select teste.deve_falhar($$insert into public.cafe_vendas (data, cliente, valor_total, forma, recebido_em)
  values ('2026-09-01', '305', 54, 'debito', '2026-09-01')$$, 'cartão exige bandeira');
select teste.deve_falhar($$insert into public.cafe_vendas (data, cliente, valor_total, pago)
  values ('2026-09-01', '305', 54, false)$$, 'a receber só de mensalista');
insert into public.cafe_mensalistas (nome, apartamento) values ('Hóspede longa estadia', '1401');
insert into public.cafe_vendas (data, cliente, mensalista_id, quantidade, valor_total, pago)
  select '2026-09-02', '1401', id, 2, 20, false from public.cafe_mensalistas;
update public.cafe_vendas set conferido = true;
select teste.afirmar((select count(*) = 0 from public.cafe_vendas where conferido), 'operador não confere');

-- Financeiro confere e recebe do mensalista.
reset role; select teste.como('financeiro@teste.local'); set role authenticated;
update public.cafe_vendas set conferido = true where cliente = 'Passante';
select teste.afirmar((select conferido_por is not null from public.cafe_vendas where cliente = 'Passante'), 'conferência carimbada');
update public.cafe_vendas set pago = true, forma = 'pix', recebido_em = '2026-09-10' where mensalista_id is not null;
select teste.afirmar((select count(*) = 0 from public.cafe_vendas where not pago), 'mensalista acertado');

-- Consulta só lê; operador não fecha quinzena.
reset role; select teste.como('consulta@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 1 from public.cafe_dias), 'consulta vê o café');
select teste.deve_falhar($$insert into public.cafe_ajustes (data, apartamento, quantidade, valor_unitario, motivo)
  values ('2026-09-02', '1', 1, 10, 'late_checkin')$$, 'consulta não lança');
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.deve_falhar($$insert into public.quinzenas_hotel (inicio, fim) values ('2026-09-01', '2026-09-15')$$, 'operador não fecha quinzena');

-- Gerente fecha a quinzena: lançamentos do período ficam travados; reabrir exige motivo.
reset role; select teste.como('gerente@teste.local'); set role authenticated;
insert into public.quinzenas_hotel (inicio, fim, resumo) values ('2026-09-01', '2026-09-15', '{"cafes": 600}');
select teste.deve_falhar($$insert into public.cafe_ajustes (data, apartamento, quantidade, valor_unitario, motivo)
  values ('2026-09-03', '9', 1, 10, 'late_checkin')$$, 'quinzena enviada trava novos ajustes');
select teste.deve_falhar($$update public.cafe_dias set hospedes = 1$$, 'quinzena enviada trava o dia');
select teste.deve_falhar($$update public.quinzenas_hotel set resumo = '{}'$$, 'resumo enviado não muda');
update public.quinzenas_hotel set reconhecido = '{"cafes": 590}', situacao = 'paga', valor_pago = 590, pago_em = '2026-09-30';
select teste.deve_falhar($$update public.quinzenas_hotel set situacao = 'reaberta'$$, 'reabrir exige motivo');
update public.quinzenas_hotel set situacao = 'reaberta', motivo_reabertura = 'Hotel pediu revisão';
update public.cafe_dias set hospedes = 101;
select teste.afirmar((select hospedes = 101 from public.cafe_dias), 'reaberta volta a aceitar correções');
insert into public.quinzenas_hotel (inicio, fim, resumo) values ('2026-09-01', '2026-09-15', '{"cafes": 600}');
select teste.afirmar((select count(*) = 2 from public.quinzenas_hotel), 'novo fechamento depois de reabrir');

-- Gerente cancela venda com motivo.
select teste.deve_falhar($$update public.cafe_vendas set situacao = 'cancelado' where cliente = 'Passante'$$, 'cancelar exige motivo');
update public.cafe_vendas set situacao = 'cancelado', motivo_cancelamento = 'Lançada em duplicidade' where cliente = 'Passante';

-- RH não vê o café.
reset role; select teste.como('rh@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.cafe_vendas), 'RH não vê vendas de café');
reset role;
