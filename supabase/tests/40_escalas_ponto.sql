-- Escalas, troca/cópia de escala, ponto com aprovação e fechamento da folha-ponto.
-- Usa os colaboradores criados em 30_colaboradores.sql (Maria Exemplo e João Diarista).

-- RH monta a escala.
reset role; select teste.como('rh@teste.local'); set role authenticated;
insert into public.escalas (colaborador_id, data, tipo, turno, hora_inicio, hora_fim, intervalo_minutos)
  select id, '2026-10-05', 'turno', 'Manhã', '06:00', '14:00', 60 from public.colaboradores where nome = 'Maria Exemplo';
insert into public.escalas (colaborador_id, data, tipo)
  select id, '2026-10-05', 'folga' from public.colaboradores where nome = 'João Diarista';
select teste.deve_falhar($$insert into public.escalas (colaborador_id, data, tipo)
  select id, '2026-10-05', 'folga' from public.colaboradores where nome = 'Maria Exemplo'$$, 'um registro de escala por pessoa por dia');
select teste.deve_falhar($$insert into public.escalas (colaborador_id, data, tipo)
  select id, '2026-10-06', 'turno' from public.colaboradores where nome = 'Maria Exemplo'$$, 'turno exige horário');

-- Troca: Maria fica de folga e João assume o turno; exige motivo.
select teste.deve_falhar($$select public.trocar_escala(
  (select e.id from public.escalas e join public.colaboradores c on c.id = e.colaborador_id where c.nome = 'Maria Exemplo'),
  (select e.id from public.escalas e join public.colaboradores c on c.id = e.colaborador_id where c.nome = 'João Diarista'), ' ')$$,
  'troca sem motivo');
select public.trocar_escala(
  (select e.id from public.escalas e join public.colaboradores c on c.id = e.colaborador_id where c.nome = 'Maria Exemplo'),
  (select e.id from public.escalas e join public.colaboradores c on c.id = e.colaborador_id where c.nome = 'João Diarista'),
  'Pedido da Maria');
select teste.afirmar((select e.tipo = 'turno' and e.hora_inicio = '06:00' from public.escalas e
  join public.colaboradores c on c.id = e.colaborador_id where c.nome = 'João Diarista'), 'troca passou o turno para o João');
select teste.afirmar((select e.tipo = 'folga' from public.escalas e
  join public.colaboradores c on c.id = e.colaborador_id where c.nome = 'Maria Exemplo'), 'troca deixou a Maria de folga');

-- Copiar a semana: cria os dias da semana seguinte sem duplicar.
select teste.afirmar((select public.copiar_escala('2026-10-05', '2026-10-12', 7) = 2), 'copia 2 dias para a semana seguinte');
select teste.afirmar((select public.copiar_escala('2026-10-05', '2026-10-12', 7) = 0), 'copiar de novo não duplica');

-- Operador e consulta só veem a escala (e os nomes pela função própria).
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 4 from public.escalas), 'operador vê a escala');
select teste.afirmar((select count(*) = 2 from public.pessoas_escala()), 'operador vê os nomes da escala');
select teste.afirmar((select count(*) = 0 from public.colaboradores), 'operador continua sem ver as fichas');
select teste.deve_falhar($$insert into public.escalas (colaborador_id, data, tipo)
  select id, '2026-10-20', 'folga' from public.pessoas_escala() limit 1$$, 'operador não cria escala');
select teste.deve_falhar($$select public.copiar_escala('2026-10-05', '2026-10-19', 7)$$, 'operador não copia escala');
select teste.afirmar((select count(*) = 0 from public.registros_ponto), 'operador não vê ponto');

-- Financeiro não tem acesso a escala nem ponto.
reset role; select teste.como('financeiro@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.escalas), 'financeiro não vê escala');
select teste.afirmar((select count(*) = 2 from public.pessoas_escala()), 'financeiro vê nomes (pode ver colaboradores)');

-- Inativo não vê nada.
reset role; select teste.como('inativo@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.pessoas_escala()), 'usuário desativado não vê nomes');

-- Ponto: RH registra; marcação nasce registrada; uma por dia.
reset role; select teste.como('rh@teste.local'); set role authenticated;
insert into public.registros_ponto (colaborador_id, data, entrada, saida_intervalo, volta_intervalo, saida)
  select id, '2026-10-05', '06:05', '10:00', '11:00', '14:10' from public.colaboradores where nome = 'João Diarista';
select teste.deve_falhar($$insert into public.registros_ponto (colaborador_id, data, entrada)
  select id, '2026-10-05', '07:00' from public.colaboradores where nome = 'João Diarista'$$, 'uma marcação por dia');
select teste.deve_falhar($$insert into public.registros_ponto (colaborador_id, data, entrada, situacao)
  select id, '2026-10-06', '07:00', 'aprovada' from public.colaboradores where nome = 'João Diarista'$$, 'marcação nasce registrada');
select teste.deve_falhar($$insert into public.registros_ponto (colaborador_id, data, entrada, saida_intervalo)
  select id, '2026-10-07', '07:00', '10:00' from public.colaboradores where nome = 'João Diarista'$$, 'intervalo precisa de saída e volta');

-- Fechar com marcação pendente: bloqueado.
select teste.deve_falhar($$insert into public.fechamentos_ponto (colaborador_id, competencia)
  select id, '2026-10' from public.colaboradores where nome = 'João Diarista'$$, 'não fecha com pendência');

-- Aprovar carimba; editar horário de aprovada volta para registrada.
update public.registros_ponto set situacao = 'aprovada';
select teste.afirmar((select aprovado_por is not null from public.registros_ponto), 'aprovação do ponto carimbada');
update public.registros_ponto set saida = '14:20';
select teste.afirmar((select situacao = 'registrada' and aprovado_por is null from public.registros_ponto), 'edição reabre a aprovação');
update public.registros_ponto set situacao = 'aprovada';

-- Fechar o mês: depois disso, nada muda no ponto do mês.
insert into public.fechamentos_ponto (colaborador_id, competencia, resumo)
  select id, '2026-10', '{"trabalhado_min": 430}' from public.colaboradores where nome = 'João Diarista';
select teste.deve_falhar($$update public.registros_ponto set saida = '15:00'$$, 'mês fechado bloqueia edição');
select teste.deve_falhar($$insert into public.registros_ponto (colaborador_id, data, entrada)
  select id, '2026-10-20', '07:00' from public.colaboradores where nome = 'João Diarista'$$, 'mês fechado bloqueia nova marcação');
select teste.deve_falhar($$update public.fechamentos_ponto set resumo = '{}'$$, 'fechamento não é alterado');
select teste.deve_falhar($$update public.fechamentos_ponto set situacao = 'reaberto'$$, 'reabrir exige motivo');
update public.fechamentos_ponto set situacao = 'reaberto', motivo_reabertura = 'Correção de horário';
select teste.afirmar((select reaberto_por is not null from public.fechamentos_ponto), 'reabertura carimbada');
update public.registros_ponto set saida = '14:30';
select teste.afirmar((select saida = '14:30' from public.registros_ponto), 'reaberto volta a aceitar ajustes');

-- Consulta não vê ponto nem fecha.
reset role; select teste.como('consulta@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.registros_ponto), 'consulta não vê ponto');
select teste.deve_falhar($$insert into public.fechamentos_ponto (colaborador_id, competencia)
  select id, '2026-11' from public.pessoas_escala() limit 1$$, 'consulta não fecha folha');
reset role;
