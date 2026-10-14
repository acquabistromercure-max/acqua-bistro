-- Horário fixo na ficha e escala gerada a partir dele.

reset role; select teste.como('rh@teste.local'); set role authenticated;
update public.colaboradores set horario_entrada = '06:00', horario_saida = '14:20', intervalo_minutos = 60, dias_folga = '{7}'
  where nome = 'Maria Exemplo';
select teste.deve_falhar($$update public.colaboradores set dias_folga = '{8}' where nome = 'Maria Exemplo'$$, 'dia de folga entre 1 e 7');

-- Semana de 2026-12-07 (segunda) a 2026-12-13 (domingo): 6 turnos + 1 folga, só para quem tem horário.
select teste.afirmar((select public.gerar_escala_padrao('2026-12-07', '2026-12-13') = 7), 'gera 7 dias para a Maria');
select teste.afirmar((select tipo = 'folga' from public.escalas e join public.colaboradores c on c.id = e.colaborador_id
  where c.nome = 'Maria Exemplo' and e.data = '2026-12-13'), 'domingo vira folga');
select teste.afirmar((select public.gerar_escala_padrao('2026-12-07', '2026-12-13') = 0), 'não duplica nem sobrescreve');
select teste.afirmar((select horario_entrada = '06:00' from public.pessoas_escala() where nome = 'Maria Exemplo'), 'horário aparece para quem monta a escala');

-- Operador não gera escala.
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.deve_falhar($$select public.gerar_escala_padrao('2026-12-14', '2026-12-20')$$, 'operador não gera escala');
reset role;
