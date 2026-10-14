-- Perfis de usuário: nome e papel (permissão) de cada pessoa que entra no sistema.
-- Cada usuário criado em Authentication → Users ganha um perfil automaticamente.

create type public.papel_usuario as enum (
  'administrador', 'gerente', 'financeiro', 'rh', 'operador', 'consulta'
);

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nome text,
  papel public.papel_usuario not null default 'consulta',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.perfis is 'Perfil e papel de acesso de cada usuário do sistema.';

alter table public.perfis enable row level security;

-- Diz se quem está logado é administrador ativo. "security definer" evita recursão na regra abaixo.
create function public.eh_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'administrador' and ativo
  );
$$;

revoke execute on function public.eh_administrador() from public, anon;
grant execute on function public.eh_administrador() to authenticated;

-- Cada um vê o próprio perfil; administradores veem todos.
create policy "ver proprio perfil ou admin"
  on public.perfis for select
  to authenticated
  using (id = (select auth.uid()) or (select public.eh_administrador()));

-- Só administradores alteram perfis (ninguém muda o próprio papel).
create policy "admin altera perfis"
  on public.perfis for update
  to authenticated
  using ((select public.eh_administrador()))
  with check ((select public.eh_administrador()));

-- Sem regras de insert/delete: perfis nascem pelo gatilho abaixo e somem junto com o usuário.

create function public.atualizar_data_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function public.atualizar_data_perfil();

-- Cria o perfil quando um usuário é cadastrado. O primeiro administrador foi definido pelo dono:
-- acquabistromercure@gmail.com. Os demais começam como "consulta" e o administrador ajusta.
create function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, email, nome, papel)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nome',
    case when lower(new.email) = 'acquabistromercure@gmail.com'
      then 'administrador'::public.papel_usuario
      else 'consulta'::public.papel_usuario
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.criar_perfil_novo_usuario() from public, anon, authenticated;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- Usuários que já existiam antes desta migration também ganham perfil.
insert into public.perfis (id, email, papel)
select
  u.id,
  u.email,
  case when lower(u.email) = 'acquabistromercure@gmail.com'
    then 'administrador'::public.papel_usuario
    else 'consulta'::public.papel_usuario
  end
from auth.users u
where u.email is not null
on conflict (id) do nothing;
