-- Move as funções de permissão para um schema que NÃO é exposto pela API (alerta do Supabase:
-- funções security definer não devem ser chamáveis via /rest/v1/rpc). As regras de acesso (RLS)
-- continuam funcionando, pois apontam para a função em si, não para o nome.

create schema if not exists privado;
grant usage on schema privado to authenticated;

alter function public.eh_administrador() set schema privado;
alter function public.meu_papel() set schema privado;
alter function public.usuario_ativo() set schema privado;
alter function public.pode(text, text) set schema privado;

comment on schema privado is 'Funções internas usadas pelas regras de acesso (RLS). Não expostas pela API.';
