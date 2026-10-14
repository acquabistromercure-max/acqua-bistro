# Acqua Bistrô — Sistema Administrativo

Sistema web de gestão do restaurante hoteleiro Acqua Bistrô (Fortaleza). Substitui papel e planilhas:
cafés da manhã, colaboradores/diaristas, escalas e ponto, caixa, eventos, cartão empresa, pedidos/compras
e documentos. Especificação completa em `docs/Briefing_Completo_Acqua_Bistro.pdf` (texto igual ao `.docx`).

## Como falar com o dono do projeto
- Ele **não é programador**. Responder sempre em **português simples, sem jargão**.
- Quando ele precisar clicar em algo (GitHub, Supabase), dizer o caminho exato: "Menu X → Aba Y → botão Z".
- Mostrar um plano curto e confirmar antes de mudanças grandes.

## Onde tudo roda (nada no PC do dono)
- **Codespace** (este ambiente): onde o código é editado. Node 22. Supabase CLI instalado pelo devcontainer.
- **GitHub**: `acquabistromercure-max/acqua-bistro` (público). Branch principal: `main`.
- **GitHub Pages**: o site é publicado pelo workflow `.github/workflows/deploy.yml` a cada push na `main`.
  Endereço: https://acquabistromercure-max.github.io/acqua-bistro/
- **Supabase**: projeto `wiocgyawzwuaqcunubrw` (URL `https://wiocgyawzwuaqcunubrw.supabase.co`).
  A integração com o GitHub aplica automaticamente o que estiver em `supabase/migrations/` a cada push na `main`.
  `supabase/config.toml` vale só para ambiente local, não muda o projeto de produção.

## Tecnologia (decidida com o dono — difere da sugestão do briefing)
- Vite + React + TypeScript + Tailwind CSS + Supabase JS (Auth, banco Postgres, Storage).
- Sem backend próprio (o briefing sugeria Next.js + NestJS; trocado por simplicidade e hospedagem gratuita).
  Regras de segurança ficam no banco: **RLS em toda tabela**, funções no Postgres e, se preciso, Edge Functions.
- Rotas com `HashRouter` (o GitHub Pages não tem reescrita de URL). `base` do Vite = `/acqua-bistro/`.
- Variáveis: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
  Local: arquivo `.env` (ignorado pelo git; modelo em `.env.example`). Deploy: secrets do repositório.
  A anon key é pública por natureza; **nunca** colocar a `service_role` no frontend nem no repositório.

## Comandos
- `npm install` — instala dependências.
- `npm run dev` — abre o site no Codespace (porta 5173).
- `npm run build` — checa tipos e gera `dist/`.
- `npm run lint` — checagem de tipos.

## Identidade visual
- Paleta: azul acqua `#83C7D8`, azul profundo `#354866`, dourado `#D9A126`, branco gelo `#F7FAFB`,
  azul suave `#E4F2F5`, branco `#FFFFFF` (definida em `tailwind.config.js`, prefixo `acqua-`).
- Login idêntico a `docs/Mockup_Login_Acqua_Bistro.png`: foto à esquerda com logo + slogan
  "Gastronomia que conecta pessoas" + "Sabor, experiências e bons momentos em harmonia com o mar.";
  cartão à direita "Bem-vindo(a) ao Acqua Bistrô" / "Acesse sua conta para continuar".
- Imagens provisórias em `src/assets/`: `login-bg.jpg` (recortada do mockup) e `logo.png` (logo de referência
  sem fundo). **Trocar** quando chegarem a foto original e o logo vetorial (SVG).

## Regras do produto (do briefing)
- Uma informação é registrada uma vez e propagada por vínculos — nada de saldos digitados em várias telas.
- Toda movimentação sensível: usuário, data/hora, justificativa e trilha de auditoria.
- Separar registro operacional, aprovação e consequência financeira/trabalhista. Nunca transformar ocorrência
  em desconto automaticamente.
- Login: mensagens de erro genéricas; nunca mostrar IP/últimos acessos na tela pública.
- "Esqueci minha senha": resposta sempre igual, sem revelar se o e-mail existe. Link de uso único (Supabase Auth).
- Sem cadastro público: usuários são criados pelo administrador (painel do Supabase → Authentication → Users).
- Cartão empresa: só banco, apelido, 4 últimos dígitos, fechamento e vencimento. Jamais CVV ou número completo.
- Perfis: Administrador, Gerente, Financeiro, RH, Operador, Consulta. Permissões por módulo e ação.
- Textos trabalhistas/fiscais precisam de validação do RH/contabilidade/jurídico antes de produção (LGPD também).

## Decisões tomadas
- 14/10/2026: Vite + Supabase em vez de Next.js + NestJS; GitHub Pages para hospedar.
- 14/10/2026: primeiro administrador = `acquabistromercure@gmail.com`.
- 14/10/2026: e-mail de recuperação usa o envio padrão do Supabase por enquanto (limite baixo por hora).
  Depois: SMTP do Gmail `acquabistromercure@gmail.com` com "senha de app" (Supabase → Authentication → SMTP).
- 14/10/2026: MFA, histórico de acessos com IP e área "Segurança e sessões" ficam para depois do login.

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
