# Acqua Bistrô — Sistema Administrativo

Sistema web de gestão do restaurante hoteleiro Acqua Bistrô (Fortaleza). Substitui papel e planilhas:
cafés da manhã, colaboradores/diaristas, escalas e ponto, caixa, eventos, cartão empresa, pedidos/compras
e documentos. Especificação completa em `docs/Briefing_Completo_Acqua_Bistro.pdf` (texto igual ao `.docx`).

## Como falar com o dono do projeto
- Ele **não é programador**. Responder sempre em **português simples, sem jargão**.
- Quando ele precisar clicar em algo (GitHub, Supabase), dizer o caminho exato: "Menu X → Aba Y → botão Z".
- Mostrar um plano curto e confirmar antes de mudanças grandes.

## Onde tudo roda
- **Desde 15/10/2026 o desenvolvimento é feito pelo Claude no app desktop**, na pasta `C:\Users\Daniel Breda\code\acqua-bistro`
  do PC do dono. **Não há Node instalado no PC** (decisão do dono) — não rodar `npm` localmente. Quem testa é o GitHub:
  - Cada módulo vai numa **branch** (`modulo-N-nome`). O workflow **Verificar** (`.github/workflows/verificar.yml`) roda
    tipos, testes do site, todas as migrations + testes de RLS num Postgres temporário e o build. Acompanhar com
    `gh run list -R acquabistromercure-max/acqua-bistro -b <branch>` / `gh run watch <id> --exit-status`.
  - Só depois de verde: merge na `main` (publica o site e aplica a migration). Nunca enviar migration direto na `main`.
  - O git do PC usa a conta `dbredastore-cloud` (colaboradora do repositório); commits saem com o autor "Acqua Bistro".
    Ela **não** pode alterar arquivos em `.github/workflows/` (falta o escopo `workflow`): mudanças ali são feitas pelo
    navegador (GitHub → Add file → Upload) ou no Codespace.
  - O conector do Supabase do Claude está ligado à organização do dono ("Daniel Breda"), não à da Acqua: banco só por
    migrations. Para consultar a produção, usar o Codespace (`scripts/consultar-producao.sh`).
- **Codespace** (opcional, mais lento): Node 22 e Supabase CLI instalados pelo devcontainer. Serve para testes visuais
  com Playwright e consultas à produção.
- **GitHub**: `acquabistromercure-max/acqua-bistro` (público). Branch principal: `main`.
- **GitHub Pages**: o site é publicado pelo workflow `.github/workflows/deploy.yml` a cada push na `main`.
  Endereço oficial: **https://acquabistro.site/** (domínio comprado na Hostinger; DNS na Hostinger:
  4 registros A de `@` para 185.199.108.153 / .109.153 / .110.153 / .111.153 e CNAME `www` →
  `acquabistromercure-max.github.io`; domínio cadastrado em GitHub → Settings → Pages → Custom domain,
  com "Enforce HTTPS"). O endereço antigo https://acquabistromercure-max.github.io/acqua-bistro/ redireciona.
- **Supabase**: projeto `wiocgyawzwuaqcunubrw` (URL `https://wiocgyawzwuaqcunubrw.supabase.co`).
  A integração com o GitHub aplica automaticamente o que estiver em `supabase/migrations/` a cada push na `main`.
  `supabase/config.toml` vale só para ambiente local, não muda o projeto de produção.

## Tecnologia (decidida com o dono — difere da sugestão do briefing)
- Vite + React + TypeScript + Tailwind CSS + Supabase JS (Auth, banco Postgres, Storage).
- Sem backend próprio (o briefing sugeria Next.js + NestJS; trocado por simplicidade e hospedagem gratuita).
  Regras de segurança ficam no banco: **RLS em toda tabela**, funções no Postgres e, se preciso, Edge Functions.
- Rotas com `HashRouter` (o GitHub Pages não tem reescrita de URL). `base` do Vite = `./` (relativo),
  para funcionar no domínio próprio e no endereço do GitHub.
- Variáveis: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
  Local: arquivo `.env` (ignorado pelo git; modelo em `.env.example`). Deploy: secrets do repositório.
  A anon key é pública por natureza; **nunca** colocar a `service_role` no frontend nem no repositório.

## Comandos
- `npm install` — instala dependências.
- `npm run dev` — abre o site no Codespace (porta 5173).
- `npm run build` — checa tipos e gera `dist/`.
- `npm run lint` — checagem de tipos.
- `npm test` — testes automáticos do site (Vitest; arquivos `*.test.ts` ao lado do código).
- `npm run testar-banco` — aplica TODAS as migrations num Postgres 17 temporário do Codespace e roda os testes de
  RLS em `supabase/tests/` (`00_simulacao_supabase.sql` imita auth/storage; `01_ajudantes.sql` cria usuários de teste
  por papel; `NN_modulo.sql` = testes de cada módulo). Se faltar o Postgres: `sudo apt-get install -y postgresql`.
- `bash scripts/consultar-producao.sh "select ..."` — consulta SOMENTE LEITURA na produção (API do Supabase com
  `SUPABASE_ACCESS_TOKEN`, que existe no Codespace). Usar para conferir se migrations foram aplicadas:
  `select version from supabase_migrations.schema_migrations`.
- Edge Functions ficam em `supabase/functions/`; publicar com
  `supabase functions deploy <nome> --project-ref wiocgyawzwuaqcunubrw --use-api`.

## Checklist antes de cada push
1. `npm run lint && npm test && npm run testar-banco && npm run build`.
2. Push na `main`. Conferir: workflow "Publicar site" verde e a migration nova em `schema_migrations`.

## Identidade visual
- Paleta: azul acqua `#83C7D8`, azul profundo `#354866`, dourado `#D9A126`, branco gelo `#F7FAFB`,
  azul suave `#E4F2F5`, branco `#FFFFFF` (definida em `tailwind.config.js`, prefixo `acqua-`).
- Login idêntico a `docs/Mockup_Login_Acqua_Bistro.png`: foto à esquerda com logo + slogan
  "Gastronomia que conecta pessoas" + "Sabor, experiências e bons momentos em harmonia com o mar.";
  cartão à direita "Bem-vindo(a) ao Acqua Bistrô" / "Acesse sua conta para continuar".
- Imagens provisórias em `src/assets/`: `login-bg.jpg` (recortada do mockup) e `logo.png` (logo de referência
  sem fundo). **Trocar** quando chegarem a foto original e o logo vetorial (SVG).
- `docs/acqua_bistro_login.svg`: cartão da direita em vetor com as cores exatas (já aplicadas no código).
  O lado esquerdo dele é o mesmo PNG do mockup embutido — **não** contém a logo em vetor.

## Regras do produto (do briefing)
- Uma informação é registrada uma vez e propagada por vínculos — nada de saldos digitados em várias telas.
- Toda movimentação sensível: usuário, data/hora, justificativa e trilha de auditoria.
- Separar registro operacional, aprovação e consequência financeira/trabalhista. Nunca transformar ocorrência
  em desconto automaticamente.
- Login: mensagens de erro genéricas; nunca mostrar IP/últimos acessos na tela pública.
- "Esqueci minha senha": resposta sempre igual, sem revelar se o e-mail existe. Link de uso único (Supabase Auth).
- Sem cadastro público ("Allow new users to sign up" desligado no Supabase): o administrador convida pela tela
  Usuários (Edge Function `admin-usuarios`, que usa a service_role no servidor). Desativar = perfil inativo + login
  bloqueado; nada é apagado.
- Cartão empresa: só banco, apelido, 4 últimos dígitos, fechamento e vencimento. Jamais CVV ou número completo.
- Perfis: Administrador, Gerente, Financeiro, RH, Operador, Consulta. Permissões por módulo e ação.
- Textos trabalhistas/fiscais precisam de validação do RH/contabilidade/jurídico antes de produção (LGPD também).

## Decisões tomadas
- 14/10/2026: Vite + Supabase em vez de Next.js + NestJS; GitHub Pages para hospedar.
- 14/10/2026: primeiro administrador = `acquabistromercure@gmail.com`.
- 14/10/2026: e-mail de recuperação usa o envio padrão do Supabase por enquanto (limite baixo por hora).
  Depois: SMTP do Gmail `acquabistromercure@gmail.com` com "senha de app" (Supabase → Authentication → SMTP).
- 14/10/2026: domínio próprio acquabistro.site (Hostinger) apontado para o GitHub Pages.
  Supabase → Authentication → URL Configuration deve ter Site URL e Redirect URL nesse domínio.
- 14/10/2026: MFA, histórico de acessos com IP e área "Segurança e sessões" ficam para depois do login.

## Arquitetura do código
- `src/lib/`: `supabase.ts` (cliente), `auth.tsx` (sessão), `permissoes.tsx` (perfil + `pode(modulo, acao)`),
  `modulos.ts` (menu e lista de módulos de permissão), `formatos.ts` (moeda/data/horas, fuso America/Fortaleza).
- `src/components/ui.tsx`: Botao, Campo, Selecao, AreaTexto, Alternador, Pagina, Cartao, Tabela (vira cartões no
  celular), Janela, Confirmar, Abas, Selo, Mensagem, `mensagemErro()`. Reusar sempre.
- `src/components/LayoutApp.tsx`: menu lateral (computador) / gaveta (celular) + topo. Itens filtrados por permissão.
- Telas em `src/pages/<modulo>/`, carregadas sob demanda (`lazy` em `App.tsx`, mapa `PAGINAS`).
- Dados com `@tanstack/react-query` + supabase-js direto nas telas. Ícones: `lucide-react`.

## Banco: padrões obrigatórios
- RLS em toda tabela. Políticas usam `(select privado.pode('<modulo>', '<acao>'))` (ações: ver, criar, editar, aprovar,
  cancelar, exportar). Administrador sempre pode tudo. Usuário desativado não pode nada (`usuario_ativo()`).
- Permissões padrão por papel ficam na tabela `permissoes` (editável na tela Permissões). Módulos novos: incluir
  linhas padrão na migration e o módulo em `MODULOS_PERMISSAO`.
- Tabelas sensíveis recebem o gatilho `registrar_auditoria()` (tabela `auditoria`, só leitura, ninguém apaga).
  Incluir o nome amigável em `NOMES_TABELAS` (`src/pages/admin/Auditoria.tsx`).
- Correção normal = status `cancelado` + motivo. **Excluir** (pedido do dono em 15/10/2026) é para o que foi criado por
  engano: ação de permissão `excluir` (Administrador sempre; outros papéis só se liberados na tela Permissões), botão
  `BotaoExcluir` (`src/components/registros.tsx`) em toda janela de registro, política `for delete` em toda tabela nova,
  e a cópia fica no Histórico (gatilho de auditoria). Períodos fechados (quinzena enviada, folha-ponto fechada) também
  bloqueiam exclusão. Colaborador: `excluir_colaborador()` apaga junto escalas, ponto, ocorrências, financeiro, diárias e
  bancários (mostra a contagem antes). Usuários do sistema não são excluídos: desativar.
- Módulos novos: toda tabela precisa de política de delete com `privado.pode('<modulo>', 'excluir')` e botão Excluir.
- Regras ainda não validadas ficam na tabela `configuracoes` (chave/valor), editável pelo admin.
- Funções `security definer` sempre com `set search_path = ''` e `revoke execute ... from public, anon`.
  Funções auxiliares de RLS ficam no schema `privado` (não exposto pela API): `privado.pode`, `privado.usuario_ativo`,
  `privado.eh_administrador`, `privado.meu_papel`. Funções que o site chama via RPC ficam em `public`.
- Depois de cada push com migration: `bash scripts/alertas-supabase.sh` (alertas de segurança/desempenho).

## Decisões a validar
Suposições feitas para não travar o desenvolvimento. Cada uma pode ser mudada depois.
- **Permissões padrão por papel** (migration `..._base_permissoes_auditoria.sql`): Gerente opera e aprova quase
  tudo, mas não vê dados bancários nem usuários; Financeiro: caixa, contas, cartões, dados bancários; RH:
  colaboradores, escalas, ponto, ocorrências, documentos, dados bancários; Operador: lança cafés, caixa, eventos e
  pedidos (sem cancelar/aprovar); Consulta: só leitura de cafés, escalas, eventos e compras. Ajustável na tela.
- **Uma unidade só** (briefing: decisão pendente). Configuração `unidade_nome`.
- **Turnos**: Manhã, Tarde, Noite (configuração `turnos`).
- **Usuários veem nomes dos colegas** (necessário para mostrar "quem lançou"); dados sensíveis ficam em tabelas
  separadas com permissão própria.
- **Gestão de usuários pela Edge Function `admin-usuarios`** (convite por e-mail; desativar = perfil inativo + login
  bloqueado). O sistema impede ficar sem administrador ativo.
- **Minha rotina**: 12 tarefas iniciais tiradas do briefing (seção 4); Gerente também pode editar tarefas
  (`painel/editar`). Qualquer um que vê o painel marca tarefas, sempre em nome próprio.
- **Painel**: filtros por dia/semana/mês/ano já existem; filtros por turno e responsável ficam para quando houver
  dados desses módulos (cafés, caixa, escalas).
- **Colaboradores**: CPF opcional mas validado e único; um só cadastro serve para CLT e diaristas (campo `vinculo`);
  desligado exige data e continua no sistema (inativo). Prazo de retenção de dados de desligados: não definido.
- **Dados bancários** em tabela separada, visíveis só para Financeiro, RH e Admin (`dados_bancarios`).
- **Ocorrências**: registrar ≠ aprovar ≠ descontar. Nenhuma ocorrência gera desconto automático.
- **Financeiro do colaborador** (`lancamentos_colaborador`): fluxo pendente → aprovado → pago; cancelar exige motivo.
  Campo `origem_tipo`/`origem_id` único evita lançamento duplicado (ex.: vale vindo do caixa usará
  `origem_tipo = 'retirada_caixa'`). RH e Gerente também podem criar lançamentos.
- **Diárias**: convocada → trabalhada → aprovada → paga. Valor sugerido = remuneração da ficha. Vínculo com
  evento e geração de conta a pagar/recibo ficam para os módulos de eventos, caixa e documentos.
- **Exportação** em CSV (separador `;`, abre no Excel). PDF fica para o módulo de documentos.
- **Escala**: um registro por pessoa por dia (`escalas`, tipos turno/folga/férias/afastamento/ausência). Dois turnos no
  mesmo dia não são suportados. Tirar um dia da escala apaga a linha (fica na auditoria). Troca = cada pessoa fica com o
  dia planejado da outra (`trocar_escala`, motivo obrigatório). "Copiar semana anterior" não sobrescreve dias preenchidos.
- **Horários sugeridos por turno** (config `horarios_turnos`): Manhã 06–14, Tarde 14–22, Noite 22–06, intervalo 60 min.
- **Ponto**: lançamento manual (não é ponto eletrônico oficial — o briefing exige análise regulatória antes). Uma marcação
  por pessoa por dia (entrada, intervalo opcional, saída). Mexer nos horários de uma marcação aprovada a devolve para
  aprovação. Fechar o mês exige tudo aprovado; mês fechado bloqueia o ponto; reabrir exige motivo.
- **Cálculos da folha-ponto** (`src/lib/ponto.ts`), em horas de relógio: saldo = trabalhado − previsto; faixa noturna
  22h–05h (config `hora_noturna`, sem hora reduzida de 52m30s); tolerância de atraso 10 min (config
  `ponto_tolerancia_minutos`); feriados 2026 nacionais + CE + Fortaleza (config `feriados`, conferir todo ano).
  Adicionais, banco de horas oficial e convenção coletiva: a definir com RH/contabilidade.
- **Operador e Consulta** veem a escala (com nomes via `pessoas_escala()`), mas não o ponto.
- **Café e hotel** (desenhado a partir das planilhas reais, ver abaixo): o hotel paga por quinzena (1–15, 16–fim)
  `(servidos + tickets) × valor`, onde tickets = arredondar(max(garantido − servidos, 0)) e garantido = hóspedes × %.
  Valor e % são "fotografados" em cada `cafe_dias` (mudar a regra não altera o passado). Ajustes "por fora da lista"
  têm quantidade ± e motivos fixos (`motivo_ajuste_cafe`). Borderô = consumo na conta do quarto, com "entregue na
  recepção" (o operador pode marcar). Cafés pagos na hora guardam forma + bandeira (fonte para o caixa, sem redigitar);
  mensalistas = vendas `pago=false` acertadas depois. Enviar a quinzena trava dia/ajustes/borderô; reabrir exige motivo.
  Eventos da quinzena: valor digitado no envio até existir o módulo de eventos.
- **Valores do negócio NÃO vão para o código** (repositório público, decisão do dono 15/10/2026): preço do café,
  % garantido, itens do borderô, preços sugeridos, nomes de quem libera, taxas de cartão, % de aluguel etc. ficam em
  `configuracoes` com valor vazio/zero na migration e são preenchidos pelo administrador em telas de "Regras".
  Testes usam valores fictícios.

## Estado atual (14/10/2026)
Feito, publicado e com migration aplicada em produção (conferido com `scripts/conferir-deploy.sh`):
1. **Base** — layout logado (menu lateral/gaveta + topo), perfis e permissões por papel (tela Permissões),
   tela Usuários (convidar/desativar via Edge Function `admin-usuarios`), Histórico (auditoria).
2. **Painel** — filtro de período, atalhos (aparecem quando o módulo existe), Minha rotina.
3. **Colaboradores e diaristas** — lista com busca/filtros/exportar, ficha com abas (dados, bancários, ocorrências,
   financeiro, diárias, linha do tempo), aba geral de Diárias.

4. **Escalas e ponto** (15/10/2026) — grade semanal/mensal com repetir dias, troca, copiar semana, imprimir e exportar;
   ponto do dia com aprovação em lote; folha-ponto do mês com totais, divergências, impressão para assinatura e
   fechamento/reabertura; abas Escala e Ponto na ficha; card "Equipe" no painel.

5. **Café e hotel** (15/10/2026) — aba Dia (hotel com garantido/tickets, por fora da lista, borderô, cafés pagos na
   hora com forma/bandeira e conferência), Quinzena com o hotel (dia a dia, Restaurante × Hotel, envio, valores aceitos,
   pagamento, reabertura, exportar/imprimir), Mensalistas (saldo e acerto), Regras (só admin edita); card no painel.
   Também: logo em vetor (`src/components/LogoAcqua.tsx`) e login sem o aviso de remetente.

6. **Caixa** (16/10/2026) — dia por forma/bandeira (puxa as vendas de café sem redigitar), movimentos com responsável e
   motivo, retirada para colaborador vira lançamento na ficha (gatilho `sincronizar_movimento_colaborador`), fundo de
   despesas, mês, previsão de recebimentos, Regras (taxas, prazos, saldo inicial).
7. **Compras** — fornecedores, catálogo por categoria, pedidos (lista por categoria para imprimir) e **Contas a pagar**
   (módulo de permissão próprio `contas`; RH/operador não veem).
8. **Cartão empresa** — só o final (4 dígitos), compras parceladas, faturas pelo dia de fechamento, pagamento.
9. **Eventos e coffee break** — agenda, modelos com itens por pessoa, produtos avulsos, clientes, consumos, etapas,
   equipe extra com diárias (`diarias.evento_id`), orçamento e lista de produção.
10. **Documentos** — recibo de adiantamento/vale/diária, ocorrência, advertência, termo de domingo e folha-ponto, com
   valor por extenso, html imutável, cópia assinada no bucket privado `documentos`; modelos e dados da empresa editáveis.
11. **Painel financeiro** (`/financeiro`, permissão `contas`) — receita × despesa, resultado, margem, 6 quinzenas lado a
   lado, por origem/categoria/fornecedor, próximos 30 dias, alertas. **Evitar contar duas vezes**: café pago entra pelo
   caixa; parcela de cartão conta, a fatura paga não; retirada de caixa para colaborador é despesa do caixa, não da ficha.
12. **Pente fino** (16/10/2026) — horário fixo e folgas na ficha (`horario_entrada/saida`, `intervalo_minutos`,
   `dias_folga` 1=seg…7=dom); `escalaDoDia` usa o horário fixo quando o dia não tem escala; botão "Preencher pelo horário
   fixo" (`gerar_escala_padrao`); aba **Horas do mês** (geral ou por pessoa, extras/noturnas/faltas/vales, CSV e
   impressão para a contabilidade; passagem = dias × `passagem_valor_dia`); "Novo diarista"
   (`/colaboradores/novo?vinculo=diarista`); ocorrência aprovada → "Gerar desconto" (`origem_tipo='ocorrencia'`); café
   "Faturar para empresa" com `cafe_ajustes.cliente_id` (clientes de Eventos).

Migrations aplicadas: `20261014010000` a `20261016060000`. Testes: Vitest (`src/lib/*.test.ts`) + RLS em `supabase/tests/`.

**Planilhas reais da operação**: ficam em `planilhas-reais/` (ignorada pelo git, dados pessoais) com o resumo em
`planilhas-reais/ANALISE.md`. Ler o resumo antes de desenhar caixa, compras, passagens e contabilidade.

**Próximos passos**: aluguel ao hotel (% das vendas por fora, em Regras) e automações. Para cada módulo: migration + teste RLS em `supabase/tests/NN_modulo.sql`, telas em
`src/pages/<modulo>/`, rota em `PAGINAS` (`App.tsx`), tirar `emBreve` em `src/lib/modulos.ts`, nomes em
`NOMES_TABELAS`, commit + push, `bash scripts/conferir-deploy.sh` e `bash scripts/alertas-supabase.sh`, resumo de
3 linhas ao dono.

**Pontos de encaixe já prontos para os próximos módulos:**
- `src/pages/painel/cards.tsx` (`CARDS`): cada módulo registra seu card no painel (recebe o filtro de período).
- `src/pages/colaboradores/abasExtras.ts` (`ABAS_EXTRAS`): abas da ficha vindas de outros módulos (Escala, Ponto,
  Documentos).
- `src/pages/painel/Atalhos.tsx`: atalhos abrem `<rota>?novo=1` (ou `?novo=vale` / `?novo=retirada` no caixa); a
  tela do módulo deve abrir o formulário ao ver esse parâmetro.
- `public.controlar_situacao('<modulo>')` (gatilho): exige permissão para aprovar/cancelar, carimba quem aprovou e
  bloqueia mudanças em registro cancelado. Tabela precisa de `situacao`, `aprovado_por`, `aprovado_em`.
- `src/components/registros.tsx`: `SeloSituacao` e `JanelaCancelar` (motivo obrigatório).

**Ambiente de teste** (não fica no repositório): o Postgres local é instalado com
`sudo apt-get install -y postgresql`. Para ver telas logadas sem senha real, usamos Playwright num diretório
temporário, com sessão falsa no `localStorage` (`sb-wiocgyawzwuaqcunubrw-auth-token`) e respostas falsas para
`/rest/v1/*`; conferir também que nenhuma tela passa de 360px de largura.

**Pendências de painel com o dono** (não bloqueiam o desenvolvimento):
- GitHub → Settings → Pages → marcar **Enforce HTTPS** (quando disponível).
- Supabase → Authentication → URL Configuration: Site URL `https://acquabistro.site/` e Redirect URL
  `https://acquabistro.site/**` (não dá para conferir pela API usada aqui).
- Opcional: Supabase → Authentication → proteção contra senhas vazadas (alerta `auth_leaked_password_protection`;
  pode exigir plano pago).
- SMTP do Gmail para os e-mails saírem de acquabistromercure@gmail.com (passo a passo já enviado ao dono; modelo do
  e-mail em `docs/email-recuperacao-senha.html`).
- Preencher Café da manhã → Regras (valor por café, % garantido, itens do borderô, preços, quem libera).
- Preencher Caixa → Regras (taxas por bandeira, prazos, saldo inicial), Documentos → Modelos (CNPJ/endereço da
  empresa), passagem por dia (Caixa → Regras) e o horário fixo/folgas de cada colaborador.
- Logo: hoje é um redesenho em vetor (`LogoAcqua.tsx`, "Bistrô" na fonte Waterfall); trocar pelo arquivo original se chegar.

## Roadmap (briefing, seção 16)
1. MVP: login/recuperação/permissões/auditoria; dashboard; colaboradores/diaristas; cafés; escala básica;
   caixa/retiradas; documentos PDF.
2. Operação integrada: horas; financeiro do colaborador; eventos/coffee; cartão e parcelas; pedidos; relatórios.
3. Evolução: estoque/validade; fornecedores; checklists; rentabilidade; notificações; integrações.

## Pendências com a operação (briefing, seção 18)
- Uma ou várias unidades; caixas/turnos.
- Modelos reais: planilha de caixa, recibos, termo de domingo, folha-ponto, lista de pedidos do Rômulo.
- Preços do café, cortesia, late check-in, faturamento a empresas.
- Jornada/adicionais/convenção com RH e contabilidade.
- Hierarquia de aprovação e prazo de guarda de históricos.
- SMTP do Gmail e testes de entrega; logo vetorial e foto original; integrações (PMS, pagamentos, contabilidade).

## Jeito de trabalhar
- Commits pequenos, mensagens em português. Push na `main` publica o site e aplica migrations — conferir antes.
- Migrations novas em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`; nunca editar uma já aplicada.
