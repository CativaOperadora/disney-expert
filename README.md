# Orlando Expert · Disney Expert

Plataforma de consultoria de viagens para Orlando da **Cativa Operadora**.
Reúne quatro módulos sobre uma mesma base de dados:

1. **Formulário público** — o cliente final responde a um diagnóstico de
   viagem a partir de um link exclusivo do agente (`/f/{codigo}`).
2. **CRM interno** — a especialista Cativa acompanha e atende as
   solicitações em um Kanban (`/painel`).
3. **Dashboards de BI** — indicadores comerciais e de operação
   (`/painel/dashboards`).
4. **Portal do Agente** — cada agência (organização) e cada agente
   acompanham suas próprias solicitações, com isolamento multi-tenant
   (`/portal`).

A especialista fala com a agência, nunca com o cliente final.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | **Next.js 15** (App Router) + **React 19**, TypeScript. CSS próprio, sem framework de UI. |
| Back-end | **Next.js Route Handlers / Server Components** (Node.js). Sem servidor separado. |
| Banco de dados | **PostgreSQL 16** (extensões `pgcrypto`, `citext`, `pg_trgm`). |
| Acesso ao banco | driver [`postgres`](https://github.com/porsager/postgres) (SQL puro, sem ORM). |
| E-mail | [Resend](https://resend.com) (opcional; a gravação nunca depende do e-mail). |
| Empacotamento | **Docker** multi-stage (build standalone do Next) + **Caddy** como proxy HTTPS. |

Sem dependências de front-end pesadas: os gráficos do BI são **SVG puro**.

---

## Estrutura do projeto

```
disney-expert/
├── app/                      Rotas (App Router)
│   ├── f/[codigo]/           Formulário público
│   ├── painel/               CRM interno (Kanban, detalhe, dashboards)
│   │   └── dashboards/       Módulo de BI (gráficos SVG)
│   ├── portal/               Portal do Agente (multi-tenant)
│   │   ├── dashboard/        Dashboard pessoal / da agência
│   │   └── usuarios/         Gestão de usuários (admin da agência)
│   ├── entrar/               Login do CRM interno
│   └── api/                  Route handlers (solicitacoes, painel, portal, fila…)
├── lib/                      Regras de negócio
│   ├── perguntas.ts          Fonte única das perguntas do formulário
│   ├── db.ts                 Conexão PostgreSQL
│   ├── briefing.ts / email.ts / fila.ts   E-mails idempotentes
│   ├── sla.ts                Colunas do Kanban e cálculo de SLA
│   ├── bi.ts                 Camada de agregação dos dashboards
│   ├── auth.ts               Sessão do CRM interno
│   └── portal-auth.ts / portal.ts   Autenticação e isolamento do Portal
├── public/                   Estáticos (imagens da capa, lista de cidades)
├── infra/                    Tudo de produção
│   ├── docker-compose.yml    banco + aplicação + proxy
│   ├── Dockerfile            imagem da aplicação (standalone)
│   ├── Caddyfile             proxy com HTTPS automático
│   ├── .env.example          modelo de variáveis de ambiente
│   ├── DEPLOY.md             guia de publicação (stack, portas, comandos)
│   ├── OPERACAO.md           manual do administrador do servidor
│   └── sql/                  schema + migrações (002–005) + seeds de demo
└── next.config.js            output: 'standalone' (necessário para o Docker)
```

---

## Rodando localmente

**Pré-requisitos:** Node.js 20+ e PostgreSQL 14+ (ou Docker).

```bash
# 1. Dependências
npm install

# 2. Banco de dados (crie um Postgres local e carregue schema + migrações,
#    NA ORDEM). Exemplo com um banco chamado disney_expert:
psql "$DATABASE_URL" -f infra/sql/schema_disney_expert.sql
psql "$DATABASE_URL" -f infra/sql/migracao_002_status_sla.sql
psql "$DATABASE_URL" -f infra/sql/migracao_003_id_reserva_crm.sql
psql "$DATABASE_URL" -f infra/sql/migracao_004_bi_financeiro.sql
psql "$DATABASE_URL" -f infra/sql/migracao_005_portal_agentes.sql

# 3. (Opcional) dados fictícios para demonstração
psql "$DATABASE_URL" -f infra/sql/seed_demo_bi.sql
psql "$DATABASE_URL" -f infra/sql/seed_demo_portal.sql

# 4. Variáveis de ambiente locais: crie um .env.local na raiz
#    (ver a tabela abaixo). No mínimo: DATABASE_URL, SESSAO_SECRET, PAINEL_SENHA.

# 5. Subir em modo desenvolvimento
npm run dev
# → http://localhost:3000
```

Rotas principais:

| Rota | O que é |
|---|---|
| `/f/{codigo}` | Formulário do cliente (ex.: `/f/CTV8213`) |
| `/entrar` · `/painel` | CRM interno da especialista |
| `/painel/dashboards` | Dashboards de BI |
| `/portal` | Portal do Agente (login em `/portal/entrar`) |

---

## Variáveis de ambiente

Em produção ficam no `infra/.env` (a partir do `infra/.env.example`). Em
desenvolvimento, num `.env.local` na raiz.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Conexão PostgreSQL. No Docker é montada a partir de `POSTGRES_*`. |
| `SESSAO_SECRET` | sim | 32+ caracteres. Assina os cookies de sessão (CRM e Portal). |
| `PAINEL_SENHA` | sim | Senha do CRM interno (`/painel`). |
| `APP_URL` | sim | URL pública (usada em links dos e-mails). |
| `FILA_SEGREDO` | recomendada | Autentica o disparo da fila de e-mails via cron. |
| `EMAIL_API_KEY` | opcional | Chave da Resend. Sem ela, os e-mails não saem (o dado é gravado mesmo assim). |
| `EMAIL_REMETENTE` / `EMAIL_RESPOSTA` | opcional | Remetente e reply-to. |
| `EMAIL_ESPECIALISTA` | sem uso | Era a cópia interna, num endereço único. Desde a migração 016 o aviso de solicitação nova vai para cada especialista ativa, no endereço de `usuarios`. Pode remover do `.env`. |
| `EMAIL_TESTE` | opcional | Se preenchida, TODA mensagem vai para este endereço. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Docker | Usadas pelo `docker-compose` para criar o banco e a `DATABASE_URL`. |

---

## Produção (VPS com Docker)

A aplicação foi desenhada para rodar em três contêineres: **banco**,
**aplicação** e **proxy HTTPS**.

```bash
cd infra
cp .env.example .env      # preencher as variáveis
docker compose up -d --build
```

Passo a passo completo, portas, backup e solução de problemas em
[`infra/DEPLOY.md`](infra/DEPLOY.md) e [`infra/OPERACAO.md`](infra/OPERACAO.md).

---

## Ambiente de homologação / demonstração

Após subir, carregue os seeds de demonstração para popular CRM, BI e Portal:

```bash
docker compose exec -T db psql -U disney -d disney_expert < sql/seed_demo_bi.sql
docker compose exec -T db psql -U disney -d disney_expert < sql/seed_demo_portal.sql
```

**Credenciais de demonstração** (senha `agente123` para o Portal):

| Perfil | Acesso |
|---|---|
| Interno / CRM | `/entrar` → senha definida em `PAINEL_SENHA` |
| Admin da Agência (Portal) | `/portal/entrar` → `rafael@mundomagico.com.br` |
| Agente de Viagens (Portal) | `/portal/entrar` → `larissa@mundomagico.com.br` |

Os seeds são **apenas para demonstração**. Para limpar, veja as instruções
no topo de cada arquivo `infra/sql/seed_demo_*.sql`.

---

## Dois princípios que não devem ser quebrados

**Gravar antes de distribuir.** Ao receber um envio, a aplicação salva no
banco e só depois dispara e-mail. Se algo posterior falhar, o dado já está
guardado.

**Isolamento multi-tenant no Portal.** Toda consulta do Portal é recortada
pela sessão (`lib/portal.ts`): o agente vê só as próprias solicitações; o
administrador, só as da própria agência. Papel e agência são recarregados
do banco a cada requisição — nunca vêm do cookie.
