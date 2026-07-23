# Disney Expert · Manual de operação

Documento para quem administra o servidor. Não pressupõe que a pessoa
tenha participado da construção do sistema.

---

## O que roda neste servidor

Três programas dentro do Docker:

| Serviço | O que faz | Se cair |
|---|---|---|
| `db` | PostgreSQL, guarda todos os formulários | Nada é gravado, formulários se perdem |
| `app` | Formulário público e painel interno | Site fora do ar |
| `proxy` | Recebe da internet e cuida do HTTPS | Site fora do ar |

O banco não é acessível pela internet. Só a aplicação fala com ele, por
dentro do Docker. Isso é intencional e não deve ser alterado.

---

## Instalação, primeira vez

Servidor recomendado: **Ubuntu 24.04, 2 vCPU e 4 GB de RAM**. Com menos
de 4 GB, a compilação da aplicação costuma travar por falta de memória.

**1. Acesso e segurança**

```bash
# Entrar como root e criar um usuário sem privilégios totais
adduser cativa
usermod -aG sudo cativa

# Desligar login por senha, deixando só chave SSH
sudo nano /etc/ssh/sshd_config
#   PasswordAuthentication no
#   PermitRootLogin no
sudo systemctl restart ssh

# Firewall: só SSH, HTTP e HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Bloqueio de tentativas repetidas de login
sudo apt install -y fail2ban
```

**2. Docker**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker cativa
# Saia e entre de novo para o grupo valer
```

**3. Projeto**

```bash
sudo mkdir -p /opt/disney-expert
sudo chown cativa:cativa /opt/disney-expert
cd /opt/disney-expert
git clone <URL_DO_REPOSITORIO> .

cd infra
cp .env.example .env
nano .env            # preencher todas as variáveis
cp /caminho/do/schema_disney_expert.sql sql/
```

**4. Apontar o domínio**

No painel de DNS da Hostinger, crie um registro A do subdomínio
apontando para o IP do VPS. Espere propagar antes do próximo passo,
senão a emissão do certificado HTTPS falha.

```bash
dig +short disney.cativa.tur.br      # precisa devolver o IP do VPS
```

**5. Subir**

```bash
cd /opt/disney-expert/infra
docker compose up -d --build
docker compose ps                     # os três devem estar "running"
docker compose logs -f app
```

**6. Agendar o backup**

```bash
chmod +x /opt/disney-expert/infra/backup.sh
sudo crontab -e
# acrescentar:
0 3 * * * /opt/disney-expert/infra/backup.sh >> /var/log/backup-disney.log 2>&1
```

**7. Monitoramento externo**

Cadastre o endereço do formulário em um serviço externo de uptime, como
UptimeRobot ou BetterStack. Precisa ser externo: monitoramento instalado
no próprio servidor morre junto com ele.

---

## Publicar uma versão nova

```bash
cd /opt/disney-expert
git pull
cd infra
docker compose up -d --build
```

A aplicação fica alguns segundos indisponível durante a troca. Publique
fora do horário comercial sempre que possível.

---

## Backup e restauração

O backup roda todo dia às 3h, guarda 14 dias no servidor e envia uma
cópia para o destino remoto configurado.

**Conferir se está funcionando:**

```bash
ls -lh /opt/disney-expert/backups/
tail -50 /var/log/backup-disney.log
```

**Restaurar (procedimento de emergência):**

```bash
cd /opt/disney-expert/infra
gunzip -c ../backups/disney_2026-07-20_0300.sql.gz | \
  docker compose exec -T db psql -U disney -d disney_expert
```

### Teste mensal obrigatório

Uma vez por mês, restaure um backup em um banco de teste e confira se os
dados aparecem. Backup nunca testado costuma não funcionar exatamente no
dia em que é necessário.

```bash
docker compose exec db createdb -U disney teste_restauracao
gunzip -c ../backups/<arquivo>.sql.gz | \
  docker compose exec -T db psql -U disney -d teste_restauracao
docker compose exec db psql -U disney -d teste_restauracao \
  -c "select count(*) from solicitacoes;"
docker compose exec db dropdb -U disney teste_restauracao
```

Anote a data do teste. Se passar mais de sessenta dias sem testar,
considere que não existe backup.

---

## Quando algo quebra

**O site não abre**

```bash
cd /opt/disney-expert/infra
docker compose ps        # algum serviço parado?
docker compose logs --tail=100 app
docker compose logs --tail=100 proxy
docker compose restart app
```

**Certificado HTTPS com erro**

Quase sempre é DNS. Confirme que o domínio ainda aponta para o IP certo
e reinicie o proxy.

```bash
dig +short disney.cativa.tur.br
docker compose restart proxy
docker compose logs proxy | grep -i certificate
```

**Formulário abre mas não grava**

Provavelmente o banco não subiu.

```bash
docker compose logs --tail=100 db
docker compose exec db pg_isready -U disney
```

**Servidor sem espaço em disco**

```bash
df -h
docker system prune -a --volumes=false   # remove imagens antigas
```

Atenção: nunca rode `docker compose down -v`. O `-v` apaga os volumes, e
com eles o banco inteiro.

**Briefing não chegou ao agente**

Não é problema de servidor. Consulte a tabela `envios_email` no banco e
verifique a coluna `status`. Se estiver `bounce`, o e-mail do agente está
errado no cadastro.

---

## Manutenção periódica

| Quando | O que |
|---|---|
| Semanal | Ler o log de backup e conferir se rodou todos os dias |
| Mensal | Testar restauração de backup em banco de teste |
| Mensal | `sudo apt update && sudo apt upgrade` e reiniciar se pedir |
| Trimestral | Revisar quem tem acesso SSH e ao painel |

---

## Acessos que precisam ter dono nomeado

Preencher e manter atualizado:

- Painel da Hostinger (VPS e DNS): _______________
- Chave SSH do servidor: _______________
- Repositório do código: _______________
- Provedor de e-mail: _______________
- Destino do backup remoto: _______________
- Serviço de monitoramento: _______________

Se qualquer linha acima estiver em nome de uma pessoa física em vez da
Cativa, corrija antes de o sistema entrar em produção.
