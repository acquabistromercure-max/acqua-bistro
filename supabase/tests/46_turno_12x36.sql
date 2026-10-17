-- Turno na ficha e regime 12x36 (dia sim, dia não) na escala gerada.

reset role; select teste.como('rh@teste.local'); set role authenticated;
select teste.deve_falhar($$update public.colaboradores set regime = '12x36', escala_referencia = null where nome = 'Maria Exemplo'$$,
  '12x36 precisa de um dia de referência');
update public.colaboradores set turno = 'Noite', regime = '12x36', escala_referencia = '2027-01-04',
  horario_entrada = '19:00', horario_saida = '07:00' where nome = 'Maria Exemplo';
select teste.afirmar((select turno = 'Noite' and regime = '12x36' from public.pessoas_escala() where nome = 'Maria Exemplo'), 'turno e regime para quem monta a escala');

-- 04/01/2027 trabalha, 05 folga, 06 trabalha... (7 dias gerados, folga fixa de domingo não vale no 12x36).
select teste.afirmar((select public.gerar_escala_padrao('2027-01-04', '2027-01-10', (select id from public.colaboradores where nome = 'Maria Exemplo')) = 7),
  'gera os 7 dias');
select teste.afirmar((select count(*) = 4 from public.escalas e join public.colaboradores c on c.id = e.colaborador_id
  where c.nome = 'Maria Exemplo' and e.data between '2027-01-04' and '2027-01-10' and e.tipo = 'turno' and e.turno = 'Noite'), '4 plantões de noite');
select teste.afirmar((select tipo = 'folga' from public.escalas e join public.colaboradores c on c.id = e.colaborador_id
  where c.nome = 'Maria Exemplo' and e.data = '2027-01-05'), 'dia seguinte é folga');
select teste.afirmar((select tipo = 'turno' from public.escalas e join public.colaboradores c on c.id = e.colaborador_id
  where c.nome = 'Maria Exemplo' and e.data = '2027-01-10'), 'domingo 10 é plantão');

-- Volta ao regime semanal para não mexer nos próximos testes.
update public.colaboradores set regime = 'semanal', escala_referencia = null, turno = null,
  horario_entrada = '06:00', horario_saida = '14:20' where nome = 'Maria Exemplo';
reset role;
delete from public.escalas where data between '2027-01-04' and '2027-01-10';
reset role;
