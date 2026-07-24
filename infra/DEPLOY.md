# Guia de Deploy · Orlando Expert

Resumo objetivo para publicar a aplicação. O manual operacional detalhado
(segurança do servidor, backup, troubleshooting) está em
[`OPERACAO.md`](OPERACAO.md).

---

## 1. Ficha técnica

| Item | Valor |
|---|---|
| **Front-end** | Next.js 15 (App Router) + React 19 + TypeScript |
| **Back-end** | Next.js Route Handlers / Server Components (Node.js 22) — a mesma aplicação serve as páginas e a API |
| **Banco de dados** | PostgreSQL 16 (extensões `pgcrypto`, `citext`, `pg_trgm`) |
| **Proxy / HTTPS** | Caddy 2 (certificado automático) |
| **Runtime** | Docker + Docker Compose (3 contêineres: `db`, `app`, `proxy`) |
| **Servidor mínimo** | Ubuntu 24.04, 2 vCPU, 4 GB RAM (menos que isso, o build do Next trava) |

### Dependências

- **Sistema:** Docker Engine + Docker Compose (via `curl -fsSL https://get.docker.com | sh`).
- **Aplicação (dentro da imagem):** instaladas por `npm ci` a partir do
  `package-lock.json` — `next`, `react`, `react-dom`, `postgres`.
- Nada precisa ser instalado no host além do Docker.

### Portas

| Porta | Onde | Exposição |
|---|---|---|
| **80 / 443** | contêiner `proxy` (Caddy) | públicas (internet) |
| **3000** | contêiner `app` (Next.js) | interna do Docker (`expose`, não publicada) |
| **5432** | contêiner `db` (PostgreSQL) | interna do Docker (nunca publicada) |

Só 80 e 443 ficam abertas para fora. Banco e aplicação só conversam pela
rede interna do Docker.

### Variáveis de ambiente

Ficam em `infra/.env` (copie de `infra/.env.example`). Obrigatórias:
`POSTGRES_PASSWORD`, `SESSAO_SECRET` (32+ aleatórios), `PAINEL_SENHA`,
`APP_URL`, `DOMINIO`. Recomendada: `FILA_SEGREDO`. Opcionais (e-mail):
`EMAIL_API_KEY` e demais `EMAIL_*`. Tabela completa no README.

---

## 2. Instalação (primeira vez)

```bash
# 1. Docker no servidor
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # relogar depois

# 2. Código
sudo mkdir -p /opt/disney-expert && sudo chown $USER /opt/disney-expert
cd /opt/disney-expert
git clone https://github.com/CativaOperadora/disney-expert.git .

# 3. Variáveis de ambiente
cd infra
cp .env.example .env
nano .env                          # preencher TODAS as obrigatórias

# 4. DNS: aponte o subdomínio (registro A) para o IP do VPS ANTES de subir,
#    senão a emissão do certificado HTTPS falha.
dig +short seu.dominio.com.br      # precisa devolver o IP do VPS

# 5. Subir (o banco roda schema + migrações 002–005 sozinho, na ordem)
docker compose up -d --build
docker compose ps                  # db, app e proxy devem estar "running"
docker compose logs -f app
```

O banco é inicializado automaticamente **só na primeira subida**, pelos
arquivos montados em `docker-entrypoint-initdb.d` (schema e migrações, em
ordem numérica). Os seeds de demonstração **não** entram nesse init.

---

## 3. Comandos de operação

```bash
# Iniciar / parar (produção)
docker compose up -d --build       # subir ou publicar nova versão
docker compose ps                  # status
docker compose logs -f app         # acompanhar a aplicação
docker compose restart app         # reiniciar só a aplicação

# ATENÇÃO: nunca use "down -v" — o -v apaga o volume do banco.
```

### Publicar uma versão nova

```bash
cd /opt/disney-expert
git pull
cd infra
docker compose up -d --build
```

### Aplicar uma migração nova em banco já existente

O init automático só roda na criação do banco. Para um banco que já existe,
rode a migração à mão:

```bash
docker compose exec -T db psql -U disney -d disney_expert < sql/migracao_00X_nova.sql
```

---

## 4. Ambiente de homologação (demonstração à diretoria)

Igual à produção, porém com dados fictícios carregados após a subida:

```bash
cd /opt/disney-expert/infra
docker compose up -d --build

# Popular CRM, BI e Portal com dados de demonstração
docker compose exec -T db psql -U disney -d disney_expert < sql/seed_demo_bi.sql
docker compose exec -T db psql -U disney -d disney_expert < sql/seed_demo_portal.sql
```

Acessos para a demonstração:

| Perfil | Onde | Credencial |
|---|---|---|
| Usuário interno / CRM | `/entrar` | senha de `PAINEL_SENHA` |
| Administrador da Agência | `/portal/entrar` | `rafael@mundomagico.com.br` · `agente123` |
| Agente de Viagens | `/portal/entrar` | `larissa@mundomagico.com.br` · `agente123` |

É a **mesma aplicação** da produção — a homologação difere apenas pelos
dados fictícios. Para virar produção real, basta não carregar os seeds (ou
removê-los conforme o cabeçalho de cada `seed_demo_*.sql`) e cadastrar as
agências e agentes reais.

---

## 5. Checklist antes de publicar

- [ ] `infra/.env` preenchido; `SESSAO_SECRET` forte e único.
- [ ] `POSTGRES_PASSWORD` e `PAINEL_SENHA` definidos.
- [ ] DNS do domínio apontando para o VPS (certificado HTTPS depende disso).
- [ ] Firewall liberando apenas 22 (SSH), 80 e 443.
- [ ] Backup agendado (`backup.sh` no cron — ver `OPERACAO.md`).
- [ ] Seeds de demonstração **não** carregados em produção real.
