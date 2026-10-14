-- Excluir registros criados por engano (roda depois de 90_administrador.sql, usando os dados criados lá).

-- Sem a permissão "excluir", ninguém apaga (nada acontece).
reset role; select teste.como('rh@teste.local'); set role authenticated;
delete from public.ocorrencias;
select teste.afirmar((select count(*) > 0 from public.ocorrencias), 'RH sem "excluir" não apaga ocorrências');
select teste.deve_falhar($$select public.excluir_colaborador((select id from public.colaboradores where nome = 'Teste Admin'))$$,
  'RH sem "excluir" não exclui colaborador');

-- Com a permissão liberada pelo admin, o papel passa a excluir naquela área.
reset role; select teste.como('admin@teste.local'); set role authenticated;
insert into public.permissoes (papel, modulo, acao) values ('rh', 'ocorrencias', 'excluir');
reset role; select teste.como('rh@teste.local'); set role authenticated;
delete from public.ocorrencias where descricao = 'teste';
select teste.afirmar((select count(*) = 0 from public.ocorrencias where descricao = 'teste'), 'RH com "excluir" apaga ocorrência');

-- Admin: período fechado continua protegido.
reset role; select teste.como('admin@teste.local'); set role authenticated;
select teste.deve_falhar($$delete from public.cafe_dias where data = '2026-11-03'$$, 'quinzena paga protege contra exclusão');
update public.quinzenas_hotel set situacao = 'reaberta', motivo_reabertura = 'teste' where inicio = '2026-11-01';
delete from public.cafe_dias where data = '2026-11-03';
delete from public.cafe_ajustes where apartamento = '101';
delete from public.consumos_quarto where apartamento = '101';
delete from public.cafe_vendas where data = '2026-11-03';
delete from public.quinzenas_hotel where inicio = '2026-11-01';
select teste.afirmar((select count(*) = 0 from public.cafe_dias where data = '2026-11-03'), 'admin exclui dia do café');

-- Excluir colaborador com tudo o que foi lançado para ele; o histórico guarda a cópia.
select teste.afirmar((select (public.contar_registros_colaborador(id) ->> 'escalas')::int >= 1 from public.colaboradores where nome = 'Teste Admin'),
  'conta os registros ligados antes de excluir');
select public.excluir_colaborador((select id from public.colaboradores where nome = 'Teste Admin'));
select teste.afirmar((select count(*) = 0 from public.colaboradores where nome = 'Teste Admin'), 'admin exclui colaborador e registros ligados');
select teste.afirmar((select count(*) >= 1 from public.auditoria where tabela = 'colaboradores' and acao = 'apagou'), 'exclusão fica no histórico');

-- Mensalista com vendas ligadas: o banco avisa em vez de apagar as vendas sozinho.
insert into public.cafe_mensalistas (nome) values ('Mensalista teste');
insert into public.cafe_vendas (data, cliente, mensalista_id, valor_total, pago)
  select '2026-12-01', 'x', id, 10, false from public.cafe_mensalistas where nome = 'Mensalista teste';
select teste.deve_falhar($$delete from public.cafe_mensalistas where nome = 'Mensalista teste'$$, 'mensalista com vendas não some sozinho');
reset role;
