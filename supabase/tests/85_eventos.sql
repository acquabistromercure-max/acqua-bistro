-- Eventos: modelo, evento com fluxo, consumos avulsos e trava após faturar.

reset role; select teste.como('gerente@teste.local'); set role authenticated;
insert into public.clientes (nome) values ('Empresa Evento');
insert into public.evento_modelos (nome, preco_por_pessoa, itens)
  values ('Coffee simples', 49, '[{"nome": "Pão de queijo", "unidade": "un", "por_pessoa": 3}]');
insert into public.evento_produtos (nome, preco) values ('Suco 1,5L', 30);

-- Operador cria o orçamento e lança consumo no dia.
reset role; select teste.como('operador@teste.local'); set role authenticated;
insert into public.eventos (titulo, cliente_id, data, pessoas, modelo_id, preco_por_pessoa)
  select 'Treinamento', c.id, '2026-09-20', 38, m.id, 49 from public.clientes c, public.evento_modelos m;
select teste.deve_falhar($$insert into public.eventos (titulo, data, situacao) values ('x', '2026-09-20', 'confirmado')$$, 'evento nasce orçamento');
update public.eventos set pessoas = 40 where titulo = 'Treinamento';
select teste.deve_falhar($$update public.eventos set situacao = 'confirmado' where titulo = 'Treinamento'$$, 'operador não confirma');

reset role; select teste.como('gerente@teste.local'); set role authenticated;
update public.eventos set situacao = 'confirmado' where titulo = 'Treinamento';
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.deve_falhar($$update public.eventos set pessoas = 10 where titulo = 'Treinamento'$$, 'operador não muda evento confirmado');
update public.eventos set situacao = 'em_andamento' where titulo = 'Treinamento';
insert into public.evento_consumos (evento_id, produto, quantidade, preco_unitario)
  select id, 'Suco 1,5L', 2, 30 from public.eventos where titulo = 'Treinamento';
select teste.afirmar((select total = 60 from public.evento_consumos), 'consumo calcula total');
select teste.deve_falhar($$update public.eventos set situacao = 'faturado' where titulo = 'Treinamento'$$, 'operador não fatura');

-- Gerente encerra e fatura: consumos travam.
reset role; select teste.como('gerente@teste.local'); set role authenticated;
update public.eventos set situacao = 'encerrado' where titulo = 'Treinamento';
update public.eventos set situacao = 'faturado' where titulo = 'Treinamento';
select teste.deve_falhar($$insert into public.evento_consumos (evento_id, produto, quantidade, preco_unitario)
  select id, 'x', 1, 1 from public.eventos where titulo = 'Treinamento'$$, 'evento faturado não aceita consumo');
select teste.deve_falhar($$update public.eventos set situacao = 'recebido' where titulo = 'Treinamento'$$, 'recebido exige valor e data');
update public.eventos set situacao = 'recebido', valor_recebido = 2020, recebido_em = '2026-09-30' where titulo = 'Treinamento';

-- Diária ligada ao evento.
reset role; select teste.como('gerente@teste.local'); set role authenticated;
insert into public.diarias (colaborador_id, data, valor, evento_id)
  select c.id, '2026-09-20', 100, e.id from public.colaboradores c, (select id from public.eventos limit 1) e where c.nome = 'João Diarista';
select teste.afirmar((select count(*) = 1 from public.diarias where evento_id is not null), 'diária ligada ao evento');
reset role;
