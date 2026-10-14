-- Ajudantes para os testes: criar usuários de teste e "agir como" um deles.
create schema if not exists teste;

create or replace function teste.criar_usuario(p_email text, p_papel public.papel_usuario)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into auth.users (email, raw_user_meta_data) values (p_email, jsonb_build_object('nome', p_email))
  returning id into v_id;
  update public.perfis set papel = p_papel where id = v_id;
  return v_id;
end $$;

-- Define quem é o "usuário logado". Nos testes: \set u ... ; usar a macro :como abaixo.
create or replace function teste.como(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
end $$;

create or replace function teste.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FALHOU: %', p_msg; end if;
end $$;

-- Espera que o comando dê erro (ex.: bloqueado pela RLS).
create or replace function teste.deve_falhar(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FALHOU (deveria ter sido bloqueado): %', p_msg;
end $$;

grant usage on schema teste to authenticated, anon;
grant execute on all functions in schema teste to authenticated, anon;

select teste.criar_usuario('admin@teste.local', 'consulta'); -- vira admin abaixo
update public.perfis set papel = 'administrador' where email = 'admin@teste.local';
select teste.criar_usuario('gerente@teste.local', 'gerente');
select teste.criar_usuario('financeiro@teste.local', 'financeiro');
select teste.criar_usuario('rh@teste.local', 'rh');
select teste.criar_usuario('operador@teste.local', 'operador');
select teste.criar_usuario('consulta@teste.local', 'consulta');
select teste.criar_usuario('inativo@teste.local', 'gerente');
update public.perfis set ativo = false where email = 'inativo@teste.local';
