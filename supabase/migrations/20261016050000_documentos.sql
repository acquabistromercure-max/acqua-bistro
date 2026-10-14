-- DOCUMENTOS: recibos, registros de ocorrência/advertência, termo de domingo, folha-ponto e recibo de diária,
-- gerados a partir da ficha. Cada emissão guarda o texto exato (versão) e pode receber a cópia assinada (arquivo
-- privado no Storage). Situações: emitido → enviado para assinatura → assinado / cancelado.
-- Textos dos modelos e dados da empresa ficam em "configuracoes" (tela Documentos → Modelos), não no código.

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid references public.colaboradores (id) on delete cascade,
  tipo text not null check (tipo in ('recibo_adiantamento', 'recibo_vale', 'registro_ocorrencia', 'advertencia', 'termo_domingo', 'folha_ponto', 'recibo_diaria', 'outro')),
  titulo text not null,
  referencia text, -- ex.: mês "2026-09" ou id do lançamento de origem
  origem_tipo text,
  origem_id uuid,
  html text not null, -- conteúdo exato emitido (para reimprimir a mesma versão)
  situacao text not null default 'emitido' check (situacao in ('emitido', 'enviado', 'assinado', 'cancelado')),
  arquivo text, -- caminho da cópia assinada no Storage (bucket "documentos")
  assinado_em date,
  motivo_cancelamento text,
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint cancelamento_com_motivo check (situacao <> 'cancelado' or length(trim(coalesce(motivo_cancelamento, ''))) > 0)
);

create index documentos_colaborador on public.documentos (colaborador_id, criado_em desc);

alter table public.documentos enable row level security;
create policy "ver documentos" on public.documentos for select to authenticated using ((select privado.pode('documentos', 'ver')));
create policy "emitir documentos" on public.documentos for insert to authenticated
  with check ((select privado.pode('documentos', 'criar')) and situacao = 'emitido');
create policy "alterar documentos" on public.documentos for update to authenticated
  using ((select privado.pode('documentos', 'editar')) or (select privado.pode('documentos', 'cancelar')));
create policy "excluir documentos" on public.documentos for delete to authenticated using ((select privado.pode('documentos', 'excluir')));

-- O texto emitido não muda: para corrigir, cancele e emita de novo.
create function public.controlar_documento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'cancelado' then raise exception 'Documento cancelado não pode ser alterado.'; end if;
  if new.html is distinct from old.html or new.tipo is distinct from old.tipo or new.colaborador_id is distinct from old.colaborador_id then
    raise exception 'O conteúdo de um documento emitido não muda. Cancele e emita de novo.';
  end if;
  if new.situacao = 'cancelado' and not privado.pode('documentos', 'cancelar') then
    raise exception 'Você não tem permissão para cancelar documentos.';
  end if;
  if new.situacao = 'assinado' and old.situacao <> 'assinado' and new.assinado_em is null then
    new.assinado_em := (now() at time zone 'America/Fortaleza')::date;
  end if;
  return new;
end;
$$;
create trigger documentos_controle before update on public.documentos for each row execute function public.controlar_documento();
create trigger documentos_auditoria after insert or update or delete on public.documentos
  for each row execute function public.registrar_auditoria();
revoke execute on function public.controlar_documento() from public, anon, authenticated;

-- Arquivos (cópias assinadas): bucket privado; acesso pelas mesmas permissões.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "ver arquivos de documentos" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (select privado.pode('documentos', 'ver')));
create policy "enviar arquivos de documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (select privado.pode('documentos', 'editar')));
create policy "trocar arquivos de documentos" on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and (select privado.pode('documentos', 'editar')));
create policy "apagar arquivos de documentos" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and ((select privado.pode('documentos', 'editar')) or (select privado.pode('documentos', 'excluir'))));

-- Dados da empresa e textos dos modelos (preenchidos/validados pelo administrador na tela).
insert into public.configuracoes (chave, valor, descricao) values
  ('empresa_dados', '{"razao_social": "", "nome_fantasia": "Acqua Bistrô", "cnpj": "", "endereco": "", "cidade": "Fortaleza/CE"}',
   'Dados da empresa que aparecem nos documentos.'),
  ('documentos_modelos', '{}', 'Textos dos documentos (vazio = texto padrão do sistema). Validar com RH/jurídico.')
on conflict (chave) do nothing;
