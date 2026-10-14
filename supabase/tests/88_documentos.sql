-- Documentos: emissão, conteúdo imutável, assinatura e permissões.

reset role; select teste.como('rh@teste.local'); set role authenticated;
insert into public.documentos (colaborador_id, tipo, titulo, html)
  select id, 'recibo_adiantamento', 'Recibo de adiantamento', '<p>Recebi R$ 100,00</p>' from public.colaboradores where nome = 'Maria Exemplo';
select teste.deve_falhar($$update public.documentos set html = '<p>Recebi R$ 1.000,00</p>'$$, 'texto emitido não muda');
update public.documentos set situacao = 'assinado', arquivo = 'x/y.pdf';
select teste.afirmar((select assinado_em is not null from public.documentos), 'assinatura com data');
insert into storage.objects (bucket_id, name) values ('documentos', 'x/y.pdf');
select teste.afirmar((select count(*) = 1 from storage.objects where bucket_id = 'documentos'), 'RH vê o arquivo assinado');

-- Operador e financeiro (sem "documentos/editar") não veem/anexam arquivos de documentos de pessoal.
reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.afirmar((select count(*) = 0 from public.documentos), 'operador não vê documentos');
select teste.afirmar((select count(*) = 0 from storage.objects where bucket_id = 'documentos'), 'operador não vê arquivos');
select teste.deve_falhar($$insert into storage.objects (bucket_id, name) values ('documentos', 'z.pdf')$$, 'operador não envia arquivo');
reset role;
