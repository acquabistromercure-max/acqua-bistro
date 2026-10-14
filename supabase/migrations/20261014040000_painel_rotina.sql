-- PAINEL: "Minha rotina" — checklists diários, semanais, mensais e anuais do gestor.

create type public.frequencia_rotina as enum ('diaria', 'semanal', 'mensal', 'anual');

create table public.rotina_tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  frequencia public.frequencia_rotina not null,
  -- Se preenchido, a tarefa aparece só para esse papel; vazio = todos que veem o painel.
  papel public.papel_usuario,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Uma conclusão por tarefa e período. Período: '2026-10-14' (dia), '2026-W42' (semana ISO), '2026-10' (mês), '2026' (ano).
create table public.rotina_conclusoes (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.rotina_tarefas (id) on delete cascade,
  periodo text not null,
  concluido_por uuid not null default auth.uid() references public.perfis (id),
  concluido_em timestamptz not null default now(),
  observacao text,
  unique (tarefa_id, periodo)
);

create index rotina_conclusoes_periodo on public.rotina_conclusoes (periodo);

alter table public.rotina_tarefas enable row level security;
alter table public.rotina_conclusoes enable row level security;

create policy "ver tarefas da rotina" on public.rotina_tarefas for select to authenticated
  using ((select privado.pode('painel', 'ver')));
create policy "criar tarefas da rotina" on public.rotina_tarefas for insert to authenticated
  with check ((select privado.pode('painel', 'editar')));
create policy "editar tarefas da rotina" on public.rotina_tarefas for update to authenticated
  using ((select privado.pode('painel', 'editar'))) with check ((select privado.pode('painel', 'editar')));

create policy "ver conclusoes" on public.rotina_conclusoes for select to authenticated
  using ((select privado.pode('painel', 'ver')));
-- Quem vê o painel marca tarefas como feitas, sempre em nome próprio.
create policy "marcar tarefa" on public.rotina_conclusoes for insert to authenticated
  with check ((select privado.pode('painel', 'ver')) and concluido_por = (select auth.uid()));
-- Desmarcar: quem marcou, ou quem pode editar o painel.
create policy "desmarcar tarefa" on public.rotina_conclusoes for delete to authenticated
  using (concluido_por = (select auth.uid()) or (select privado.pode('painel', 'editar')));

create trigger rotina_tarefas_auditoria after insert or update or delete on public.rotina_tarefas
  for each row execute function public.registrar_auditoria();

-- Gerente pode ajustar as tarefas da rotina.
insert into public.permissoes (papel, modulo, acao) values ('gerente', 'painel', 'editar');

-- Tarefas iniciais, conforme o briefing (seção 4). Ajustáveis na tela.
insert into public.rotina_tarefas (titulo, frequencia, ordem) values
  ('Conferir abertura e fechamento do caixa', 'diaria', 1),
  ('Conferir cafés da manhã do dia', 'diaria', 2),
  ('Conferir equipe presente e folgas', 'diaria', 3),
  ('Revisar escala da próxima semana', 'semanal', 1),
  ('Revisar pedidos de compra pendentes', 'semanal', 2),
  ('Fechar folha-ponto do mês', 'mensal', 1),
  ('Conferir vales e adiantamentos', 'mensal', 2),
  ('Conferir faturas dos cartões da empresa', 'mensal', 3),
  ('Fechamento mensal do caixa e contas', 'mensal', 4),
  ('Revisar cadastros e documentos da equipe', 'anual', 1),
  ('Revisar custos e fornecedores', 'anual', 2),
  ('Planejamento do próximo ano', 'anual', 3);
