-- Colaboradores, dados bancários, ocorrências, financeiro do colaborador e diárias.

reset role; select teste.como('rh@teste.local'); set role authenticated;
insert into public.colaboradores (nome, cpf, funcao, vinculo, remuneracao) values ('Maria Exemplo', '12345678909', 'Cozinheira', 'clt', 2500);
insert into public.colaboradores (nome, funcao, vinculo, tipo_remuneracao, remuneracao) values ('João Diarista', 'Garçom', 'diarista', 'diaria', 150);
select teste.deve_falhar($$insert into public.colaboradores (nome, cpf) values ('Outra', '123')$$, 'CPF precisa ter 11 dígitos');
select teste.deve_falhar($$update public.colaboradores set situacao = 'desligado' where nome = 'Maria Exemplo'$$, 'desligar exige data');
insert into public.colaboradores_bancarios (colaborador_id, banco, pix_tipo, pix_chave)
  select id, 'Banco Exemplo', 'cpf', '12345678909' from public.colaboradores where nome = 'Maria Exemplo';
insert into public.ocorrencias (colaborador_id, tipo, data, descricao, minutos)
  select id, 'atraso', '2026-10-10', 'Chegou 20 min atrasada', 20 from public.colaboradores where nome = 'Maria Exemplo';
select teste.afirmar((select count(*) = 2 from public.colaboradores), 'RH vê colaboradores');

-- Gerente vê ficha, mas não os dados bancários.
reset role; select teste.como('gerente@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 2 from public.colaboradores), 'gerente vê colaboradores');
select teste.afirmar((select count(*) = 0 from public.colaboradores_bancarios), 'gerente NÃO vê dados bancários');
-- Gerente aprova a ocorrência: carimba quem aprovou.
update public.ocorrencias set situacao = 'aprovada';
select teste.afirmar((select aprovado_por = (select id from public.perfis where email = 'gerente@teste.local') from public.ocorrencias), 'aprovação carimbada');
-- Cancelar exige motivo.
select teste.deve_falhar($$update public.ocorrencias set situacao = 'cancelada'$$, 'cancelar sem motivo');
update public.ocorrencias set situacao = 'cancelada', motivo_cancelamento = 'Lançada em duplicidade';
select teste.deve_falhar($$update public.ocorrencias set descricao = 'x'$$, 'cancelada não muda mais');

-- Financeiro vê dados bancários e lança vale; o mesmo fato de origem só gera um lançamento.
reset role; select teste.como('financeiro@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 1 from public.colaboradores_bancarios), 'financeiro vê dados bancários');
insert into public.lancamentos_colaborador (colaborador_id, tipo, data, valor, origem_tipo, origem_id)
  select id, 'vale', '2026-10-12', 100, 'teste', '00000000-0000-0000-0000-0000000000aa' from public.colaboradores where nome = 'Maria Exemplo';
select teste.deve_falhar($$insert into public.lancamentos_colaborador (colaborador_id, tipo, data, valor, origem_tipo, origem_id)
  select id, 'vale', '2026-10-12', 100, 'teste', '00000000-0000-0000-0000-0000000000aa' from public.colaboradores where nome = 'Maria Exemplo'$$,
  'mesma origem não duplica lançamento');
select teste.deve_falhar($$insert into public.lancamentos_colaborador (colaborador_id, tipo, data, valor, situacao)
  select id, 'vale', '2026-10-12', 50, 'pago' from public.colaboradores limit 1$$, 'lançamento nasce pendente');
update public.colaboradores set funcao = 'x'; -- sem permissão de editar: não altera nada
select teste.afirmar((select count(*) = 0 from public.colaboradores where funcao = 'x'), 'financeiro não edita ficha');

-- Operador não vê colaboradores (padrão).
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.colaboradores), 'operador não vê colaboradores');
select teste.afirmar((select count(*) = 0 from public.lancamentos_colaborador), 'operador não vê financeiro');

-- Diárias: RH convoca; RH aprova; consulta não aprova.
reset role; select teste.como('rh@teste.local'); set role authenticated;
insert into public.diarias (colaborador_id, data, turno, valor)
  select id, '2026-10-15', 'Noite', 150 from public.colaboradores where nome = 'João Diarista';
update public.diarias set situacao = 'trabalhada';
update public.diarias set situacao = 'aprovada';
select teste.afirmar((select aprovado_em is not null from public.diarias), 'diária aprovada carimbada');
reset role;
