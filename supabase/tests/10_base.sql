-- Base: perfis, permissões, auditoria, configurações.

-- O primeiro administrador definido pelo dono vira admin automaticamente.
insert into auth.users (email) values ('acquabistromercure@gmail.com');
select teste.afirmar((select papel = 'administrador' from public.perfis where email = 'acquabistromercure@gmail.com'), 'admin automático');

-- Visitante sem login não vê nada.
set role anon;
select teste.afirmar((select count(*) = 0 from public.perfis), 'anon não vê perfis');
select teste.afirmar((select count(*) = 0 from public.permissoes), 'anon não vê permissões');
reset role;

-- Função pode()
reset role; select teste.como('gerente@teste.local'); set role authenticated;
select teste.afirmar(privado.pode('cafes', 'criar'), 'gerente cria café');
select teste.afirmar(not privado.pode('usuarios', 'ver'), 'gerente não gerencia usuários');
select teste.afirmar(not privado.pode('dados_bancarios', 'ver'), 'gerente não vê dados bancários');
select teste.afirmar((select count(*) > 1 from public.perfis), 'gerente vê nomes dos colegas');
-- Gerente não muda o próprio papel nem o de ninguém.
update public.perfis set papel = 'administrador' where email = 'gerente@teste.local';
reset role;
select teste.afirmar((select papel = 'gerente' from public.perfis where email = 'gerente@teste.local'), 'gerente não se promove');

reset role; select teste.como('operador@teste.local'); set role authenticated;
select teste.afirmar(privado.pode('cafes', 'criar') and not privado.pode('cafes', 'cancelar'), 'operador cria mas não cancela café');
select teste.deve_falhar($$insert into public.permissoes values ('operador','usuarios','ver')$$, 'operador não edita permissões');
select teste.afirmar((select count(*) = 0 from public.auditoria), 'operador não vê auditoria');

reset role; select teste.como('inativo@teste.local'); set role authenticated;
select teste.afirmar(not privado.pode('cafes', 'ver'), 'inativo não pode nada');
select teste.afirmar((select count(*) = 1 from public.perfis), 'inativo só vê o próprio perfil');
select teste.afirmar((select count(*) = 0 from public.configuracoes), 'inativo não lê configurações');

reset role; select teste.como('admin@teste.local'); set role authenticated;
select teste.afirmar(privado.pode('qualquer_coisa', 'aprovar'), 'admin pode tudo');
update public.perfis set papel = 'rh' where email = 'consulta@teste.local';
select teste.afirmar((select papel = 'rh' from public.perfis where email = 'consulta@teste.local'), 'admin muda papel');
update public.perfis set papel = 'consulta' where email = 'consulta@teste.local';
insert into public.permissoes values ('consulta', 'caixa', 'ver');
delete from public.permissoes where papel = 'consulta' and modulo = 'caixa';
select teste.afirmar((select count(*) >= 3 from public.auditoria where tabela in ('perfis', 'permissoes')), 'alterações auditadas');
delete from public.auditoria; -- sem regra de apagar: não remove nada
select teste.afirmar((select count(*) > 0 from public.auditoria), 'auditoria intacta');
update public.configuracoes set valor = '["Manhã","Noite"]' where chave = 'turnos';
select teste.afirmar((select valor = '["Manhã","Noite"]'::jsonb from public.configuracoes where chave = 'turnos'), 'admin altera configuração');

-- Nunca ficar sem admin ativo.
reset role;
update public.perfis set ativo = false where email = 'acquabistromercure@gmail.com';
select teste.deve_falhar($$update public.perfis set papel = 'gerente' where email = 'admin@teste.local'$$, 'último admin protegido');
update public.perfis set ativo = true where email = 'acquabistromercure@gmail.com';
