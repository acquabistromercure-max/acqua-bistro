-- BASE DO SISTEMA: permissões por papel, auditoria, configurações e proteções dos perfis.

-------------------------------------------------------------------------------
-- 1. Funções de apoio
-------------------------------------------------------------------------------

-- Papel do usuário logado (nulo se não tiver perfil ou estiver desativado).
create function public.meu_papel()
returns public.papel_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select papel from public.perfis where id = (select auth.uid()) and ativo;
$$;

create function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfis where id = (select auth.uid()) and ativo);
$$;

-------------------------------------------------------------------------------
-- 2. Permissões: papel × módulo × ação (editável pelo administrador)
-------------------------------------------------------------------------------

create table public.permissoes (
  papel public.papel_usuario not null,
  modulo text not null,
  acao text not null check (acao in ('ver', 'criar', 'editar', 'aprovar', 'cancelar', 'exportar')),
  primary key (papel, modulo, acao)
);

comment on table public.permissoes is
  'O que cada papel pode fazer em cada módulo. Administrador sempre pode tudo (não precisa de linha aqui).';

alter table public.permissoes enable row level security;

-- Verifica se o usuário logado pode executar "acao" no "modulo".
create function public.pode(p_modulo text, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select
       p.papel = 'administrador'
       or exists (
         select 1 from public.permissoes x
         where x.papel = p.papel and x.modulo = p_modulo and x.acao = p_acao
       )
     from public.perfis p
     where p.id = (select auth.uid()) and p.ativo),
    false
  );
$$;

revoke execute on function public.meu_papel(), public.usuario_ativo(), public.pode(text, text) from public, anon;
grant execute on function public.meu_papel(), public.usuario_ativo(), public.pode(text, text) to authenticated;

create policy "usuarios ativos leem permissoes"
  on public.permissoes for select to authenticated
  using ((select public.usuario_ativo()));

create policy "admin gerencia permissoes - inserir"
  on public.permissoes for insert to authenticated
  with check ((select public.eh_administrador()));

create policy "admin gerencia permissoes - apagar"
  on public.permissoes for delete to authenticated
  using ((select public.eh_administrador()));

-- Padrões iniciais (suposição: ver "Decisões a validar" no CLAUDE.md). O admin ajusta na tela Permissões.
insert into public.permissoes (papel, modulo, acao)
select papel::public.papel_usuario, modulo, acao
from (values
  -- Gerente: opera tudo, aprova e exporta; não mexe em usuários nem dados bancários.
  ('gerente', 'painel', 'ver'),
  ('gerente', 'colaboradores', 'ver'), ('gerente', 'colaboradores', 'criar'), ('gerente', 'colaboradores', 'editar'),
  ('gerente', 'colaboradores', 'exportar'),
  ('gerente', 'ocorrencias', 'ver'), ('gerente', 'ocorrencias', 'criar'), ('gerente', 'ocorrencias', 'editar'),
  ('gerente', 'ocorrencias', 'aprovar'), ('gerente', 'ocorrencias', 'cancelar'),
  ('gerente', 'escalas', 'ver'), ('gerente', 'escalas', 'criar'), ('gerente', 'escalas', 'editar'), ('gerente', 'escalas', 'exportar'),
  ('gerente', 'ponto', 'ver'), ('gerente', 'ponto', 'criar'), ('gerente', 'ponto', 'editar'), ('gerente', 'ponto', 'aprovar'),
  ('gerente', 'ponto', 'exportar'),
  ('gerente', 'cafes', 'ver'), ('gerente', 'cafes', 'criar'), ('gerente', 'cafes', 'editar'), ('gerente', 'cafes', 'aprovar'),
  ('gerente', 'cafes', 'cancelar'), ('gerente', 'cafes', 'exportar'),
  ('gerente', 'caixa', 'ver'), ('gerente', 'caixa', 'criar'), ('gerente', 'caixa', 'editar'), ('gerente', 'caixa', 'aprovar'),
  ('gerente', 'caixa', 'cancelar'), ('gerente', 'caixa', 'exportar'),
  ('gerente', 'financeiro', 'ver'), ('gerente', 'financeiro', 'aprovar'), ('gerente', 'financeiro', 'exportar'),
  ('gerente', 'eventos', 'ver'), ('gerente', 'eventos', 'criar'), ('gerente', 'eventos', 'editar'), ('gerente', 'eventos', 'aprovar'),
  ('gerente', 'eventos', 'cancelar'), ('gerente', 'eventos', 'exportar'),
  ('gerente', 'compras', 'ver'), ('gerente', 'compras', 'criar'), ('gerente', 'compras', 'editar'), ('gerente', 'compras', 'aprovar'),
  ('gerente', 'compras', 'cancelar'), ('gerente', 'compras', 'exportar'),
  ('gerente', 'cartoes', 'ver'), ('gerente', 'cartoes', 'criar'), ('gerente', 'cartoes', 'editar'), ('gerente', 'cartoes', 'exportar'),
  ('gerente', 'documentos', 'ver'), ('gerente', 'documentos', 'criar'), ('gerente', 'documentos', 'editar'),
  ('gerente', 'documentos', 'cancelar'), ('gerente', 'documentos', 'exportar'),
  ('gerente', 'auditoria', 'ver'),
  -- Financeiro: caixa, contas, cartões, cafés faturados e dados bancários.
  ('financeiro', 'painel', 'ver'),
  ('financeiro', 'colaboradores', 'ver'), ('financeiro', 'dados_bancarios', 'ver'), ('financeiro', 'dados_bancarios', 'editar'),
  ('financeiro', 'cafes', 'ver'), ('financeiro', 'cafes', 'editar'), ('financeiro', 'cafes', 'exportar'),
  ('financeiro', 'caixa', 'ver'), ('financeiro', 'caixa', 'criar'), ('financeiro', 'caixa', 'editar'), ('financeiro', 'caixa', 'aprovar'),
  ('financeiro', 'caixa', 'exportar'),
  ('financeiro', 'financeiro', 'ver'), ('financeiro', 'financeiro', 'criar'), ('financeiro', 'financeiro', 'editar'),
  ('financeiro', 'financeiro', 'aprovar'), ('financeiro', 'financeiro', 'cancelar'), ('financeiro', 'financeiro', 'exportar'),
  ('financeiro', 'eventos', 'ver'), ('financeiro', 'eventos', 'editar'), ('financeiro', 'eventos', 'exportar'),
  ('financeiro', 'compras', 'ver'), ('financeiro', 'compras', 'editar'), ('financeiro', 'compras', 'exportar'),
  ('financeiro', 'cartoes', 'ver'), ('financeiro', 'cartoes', 'criar'), ('financeiro', 'cartoes', 'editar'),
  ('financeiro', 'cartoes', 'cancelar'), ('financeiro', 'cartoes', 'exportar'),
  ('financeiro', 'documentos', 'ver'), ('financeiro', 'documentos', 'criar'),
  -- RH: colaboradores, escalas, ponto, ocorrências e documentos.
  ('rh', 'painel', 'ver'),
  ('rh', 'colaboradores', 'ver'), ('rh', 'colaboradores', 'criar'), ('rh', 'colaboradores', 'editar'), ('rh', 'colaboradores', 'exportar'),
  ('rh', 'dados_bancarios', 'ver'), ('rh', 'dados_bancarios', 'editar'),
  ('rh', 'ocorrencias', 'ver'), ('rh', 'ocorrencias', 'criar'), ('rh', 'ocorrencias', 'editar'), ('rh', 'ocorrencias', 'aprovar'),
  ('rh', 'ocorrencias', 'cancelar'),
  ('rh', 'escalas', 'ver'), ('rh', 'escalas', 'criar'), ('rh', 'escalas', 'editar'), ('rh', 'escalas', 'exportar'),
  ('rh', 'ponto', 'ver'), ('rh', 'ponto', 'criar'), ('rh', 'ponto', 'editar'), ('rh', 'ponto', 'aprovar'), ('rh', 'ponto', 'exportar'),
  ('rh', 'financeiro', 'ver'),
  ('rh', 'documentos', 'ver'), ('rh', 'documentos', 'criar'), ('rh', 'documentos', 'editar'), ('rh', 'documentos', 'cancelar'),
  ('rh', 'documentos', 'exportar'),
  -- Operador: lançamentos do dia a dia.
  ('operador', 'painel', 'ver'),
  ('operador', 'cafes', 'ver'), ('operador', 'cafes', 'criar'),
  ('operador', 'caixa', 'ver'), ('operador', 'caixa', 'criar'),
  ('operador', 'escalas', 'ver'),
  ('operador', 'eventos', 'ver'), ('operador', 'eventos', 'criar'),
  ('operador', 'compras', 'ver'), ('operador', 'compras', 'criar'),
  -- Consulta: só leitura das áreas operacionais.
  ('consulta', 'painel', 'ver'),
  ('consulta', 'cafes', 'ver'), ('consulta', 'escalas', 'ver'), ('consulta', 'eventos', 'ver'), ('consulta', 'compras', 'ver')
) as v (papel, modulo, acao);

-------------------------------------------------------------------------------
-- 3. Perfis: todos os usuários ativos veem nomes dos colegas; só admin altera.
--    Proteção: o sistema nunca fica sem administrador ativo.
-------------------------------------------------------------------------------

drop policy "ver proprio perfil ou admin" on public.perfis;

create policy "ver proprio perfil ou usuarios ativos"
  on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.usuario_ativo()));

create function public.proteger_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.papel = 'administrador' and old.ativo
     and (new.papel <> 'administrador' or not new.ativo)
     and not exists (
       select 1 from public.perfis
       where papel = 'administrador' and ativo and id <> old.id
     ) then
    raise exception 'O sistema precisa ter pelo menos um administrador ativo.';
  end if;
  return new;
end;
$$;

create trigger perfis_proteger_ultimo_admin
  before update on public.perfis
  for each row execute function public.proteger_ultimo_admin();

-------------------------------------------------------------------------------
-- 4. Auditoria: quem mudou o quê e quando (registros não podem ser alterados)
-------------------------------------------------------------------------------

create table public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text,
  acao text not null check (acao in ('criou', 'alterou', 'apagou')),
  dados_antigos jsonb,
  dados_novos jsonb,
  usuario_id uuid default auth.uid(),
  em timestamptz not null default now()
);

create index auditoria_tabela_registro on public.auditoria (tabela, registro_id);
create index auditoria_em on public.auditoria (em desc);

alter table public.auditoria enable row level security;

create policy "ver auditoria com permissao"
  on public.auditoria for select to authenticated
  using ((select public.pode('auditoria', 'ver')));
-- Sem insert/update/delete para usuários: só o gatilho grava, e ninguém edita o histórico.

create function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antigo jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_novo jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and v_antigo = v_novo then
    return new;
  end if;
  insert into public.auditoria (tabela, registro_id, acao, dados_antigos, dados_novos)
  values (
    tg_table_name,
    coalesce(v_novo ->> 'id', v_antigo ->> 'id'),
    case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'apagou' end,
    v_antigo,
    v_novo
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function public.registrar_auditoria(), public.proteger_ultimo_admin() from public, anon, authenticated;

create trigger perfis_auditoria
  after insert or update or delete on public.perfis
  for each row execute function public.registrar_auditoria();

create trigger permissoes_auditoria
  after insert or update or delete on public.permissoes
  for each row execute function public.registrar_auditoria();

-------------------------------------------------------------------------------
-- 5. Configurações gerais (chave → valor), para regras ainda a validar
-------------------------------------------------------------------------------

create table public.configuracoes (
  chave text primary key,
  valor jsonb not null,
  descricao text,
  atualizado_em timestamptz not null default now()
);

alter table public.configuracoes enable row level security;

create policy "usuarios ativos leem configuracoes"
  on public.configuracoes for select to authenticated
  using ((select public.usuario_ativo()));

create policy "admin altera configuracoes"
  on public.configuracoes for update to authenticated
  using ((select public.eh_administrador()))
  with check ((select public.eh_administrador()));

create policy "admin cria configuracoes"
  on public.configuracoes for insert to authenticated
  with check ((select public.eh_administrador()));

create trigger configuracoes_atualizado_em
  before update on public.configuracoes
  for each row execute function public.atualizar_data_perfil();

create trigger configuracoes_auditoria
  after insert or update or delete on public.configuracoes
  for each row execute function public.registrar_auditoria();

insert into public.configuracoes (chave, valor, descricao) values
  ('unidade_nome', '"Acqua Bistrô"', 'Nome da unidade (sistema preparado para uma unidade).'),
  ('turnos', '["Manhã", "Tarde", "Noite"]', 'Turnos usados em escalas, cafés e caixa.');
