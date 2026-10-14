-- O administrador pode executar TODAS as funções de TODOS os módulos (roda por último, sobre os dados dos outros testes).

reset role; select teste.como('admin@teste.local'); set role authenticated;

-- 1) A regra de permissão responde "sim" para qualquer módulo/ação, inclusive módulos futuros.
select teste.afirmar(
  (select bool_and(privado.pode(m, a))
   from unnest(array['painel', 'colaboradores', 'dados_bancarios', 'ocorrencias', 'escalas', 'ponto', 'cafes', 'caixa',
                     'financeiro', 'eventos', 'compras', 'cartoes', 'documentos', 'auditoria', 'usuarios', 'modulo_futuro']) m,
        unnest(array['ver', 'criar', 'editar', 'aprovar', 'cancelar', 'exportar']) a),
  'admin pode tudo em todos os módulos');

-- 2) Na prática, em cada área.
-- Pessoas
insert into public.colaboradores (nome, funcao) values ('Teste Admin', 'Garçom');
update public.colaboradores set funcao = 'Cozinheiro' where nome = 'Teste Admin';
insert into public.colaboradores_bancarios (colaborador_id, banco) select id, 'Banco' from public.colaboradores where nome = 'Teste Admin';
select teste.afirmar((select count(*) > 0 from public.colaboradores_bancarios), 'admin vê dados bancários');
insert into public.ocorrencias (colaborador_id, tipo, data, descricao) select id, 'atraso', '2026-11-03', 'teste' from public.colaboradores where nome = 'Teste Admin';
update public.ocorrencias set situacao = 'aprovada' where descricao = 'teste';
update public.ocorrencias set situacao = 'cancelada', motivo_cancelamento = 'teste' where descricao = 'teste';
insert into public.lancamentos_colaborador (colaborador_id, tipo, data, valor) select id, 'vale', '2026-11-03', 10 from public.colaboradores where nome = 'Teste Admin';
update public.lancamentos_colaborador set situacao = 'aprovado' where valor = 10;
update public.lancamentos_colaborador set situacao = 'pago' where valor = 10;
insert into public.diarias (colaborador_id, data, valor) select id, '2026-11-03', 50 from public.colaboradores where nome = 'Teste Admin';
update public.diarias set situacao = 'aprovada' where valor = 50;

-- Escalas e ponto
insert into public.escalas (colaborador_id, data, tipo) select id, '2026-11-03', 'folga' from public.colaboradores where nome = 'Teste Admin';
select teste.afirmar((select public.copiar_escala('2026-11-03', '2026-11-10', 1) = 1), 'admin copia escala');
delete from public.escalas where data = '2026-11-10';
insert into public.registros_ponto (colaborador_id, data, entrada, saida) select id, '2026-11-04', '08:00', '16:00' from public.colaboradores where nome = 'Teste Admin';
update public.registros_ponto set situacao = 'aprovada' where data = '2026-11-04';
insert into public.fechamentos_ponto (colaborador_id, competencia) select id, '2026-11' from public.colaboradores where nome = 'Teste Admin';
update public.fechamentos_ponto set situacao = 'reaberto', motivo_reabertura = 'teste' where competencia = '2026-11';
update public.registros_ponto set situacao = 'cancelada', motivo_cancelamento = 'teste' where data = '2026-11-04';

-- Café
insert into public.cafe_dias (data, hospedes, cafes_servidos, valor_cafe, percentual_garantido) values ('2026-11-03', 10, 8, 10, 70);
update public.cafe_dias set cafes_servidos = 9 where data = '2026-11-03';
insert into public.cafe_ajustes (data, apartamento, quantidade, valor_unitario, motivo, autorizado_por)
  values ('2026-11-03', '101', 1, 10, 'liberado_gestor', 'Admin');
update public.cafe_ajustes set situacao = 'cancelado', motivo_cancelamento = 'teste' where apartamento = '101';
insert into public.consumos_quarto (data, apartamento, item, valor_unitario) values ('2026-11-03', '101', 'Almoço', 30);
update public.consumos_quarto set valor_unitario = 35 where apartamento = '101';
insert into public.cafe_vendas (data, cliente, valor_total, forma, recebido_em) values ('2026-11-03', 'Passante', 20, 'pix', '2026-11-03');
update public.cafe_vendas set conferido = true where data = '2026-11-03';
insert into public.quinzenas_hotel (inicio, fim) values ('2026-11-01', '2026-11-15');
update public.quinzenas_hotel set situacao = 'paga', valor_pago = 100, pago_em = '2026-11-20' where inicio = '2026-11-01';

-- Administração
update public.configuracoes set valor = '{"valor_cafe": 11, "percentual_garantido": 70}' where chave = 'cafe_regras';
select teste.afirmar((select valor ->> 'valor_cafe' = '11' from public.configuracoes where chave = 'cafe_regras'), 'admin altera regras');
insert into public.permissoes (papel, modulo, acao) values ('consulta', 'documentos', 'ver');
delete from public.permissoes where papel = 'consulta' and modulo = 'documentos' and acao = 'ver';
update public.perfis set papel = 'gerente' where email = 'consulta@teste.local';
select teste.afirmar((select count(*) > 0 from public.auditoria), 'admin vê o histórico');

-- 3) Conferência final: tudo o que o admin fez acima de fato gravou.
select teste.afirmar((select situacao = 'pago' from public.lancamentos_colaborador where valor = 10), 'admin paga lançamento');
select teste.afirmar((select cafes_servidos = 9 from public.cafe_dias where data = '2026-11-03'), 'admin corrige café');
select teste.afirmar((select valor_unitario = 35 from public.consumos_quarto where apartamento = '101'), 'admin corrige borderô');
select teste.afirmar((select conferido from public.cafe_vendas where data = '2026-11-03'), 'admin confere venda');
select teste.afirmar((select situacao = 'paga' from public.quinzenas_hotel where inicio = '2026-11-01'), 'admin registra pagamento da quinzena');
select teste.afirmar((select situacao = 'cancelada' from public.registros_ponto where data = '2026-11-04'), 'admin cancela ponto');
select teste.afirmar((select papel = 'gerente' from public.perfis where email = 'consulta@teste.local'), 'admin muda papel de usuário');
reset role;
