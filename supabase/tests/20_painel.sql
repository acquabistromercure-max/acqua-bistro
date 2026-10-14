-- Painel: rotina.
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 12 from public.rotina_tarefas), 'operador vê as tarefas');
insert into public.rotina_conclusoes (tarefa_id, periodo)
  select id, '2026-10-14' from public.rotina_tarefas where titulo like 'Conferir cafés%';
select teste.afirmar((select count(*) = 1 from public.rotina_conclusoes), 'operador marca tarefa');
select teste.deve_falhar($$insert into public.rotina_conclusoes (tarefa_id, periodo, concluido_por)
  select id, '2026-10-15', (select id from public.perfis where email = 'gerente@teste.local') from public.rotina_tarefas limit 1$$,
  'não marca em nome de outra pessoa');
select teste.deve_falhar($$insert into public.rotina_conclusoes (tarefa_id, periodo)
  select id, '2026-10-14' from public.rotina_tarefas where titulo like 'Conferir cafés%'$$, 'não marca duas vezes no mesmo período');
select teste.deve_falhar($$insert into public.rotina_tarefas (titulo, frequencia) values ('x', 'diaria')$$, 'operador não cria tarefa');

reset role; select teste.como('gerente@teste.local'); set role authenticated;
insert into public.rotina_tarefas (titulo, frequencia) values ('Conferir estoque de frios', 'semanal');
delete from public.rotina_conclusoes; -- gerente pode desmarcar
select teste.afirmar((select count(*) = 0 from public.rotina_conclusoes), 'gerente desmarca');

reset role; select teste.como('inativo@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.rotina_tarefas), 'inativo não vê rotina');
reset role;
