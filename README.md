# Disney Expert

Formulário de diagnóstico de viagem para Orlando e CRM de consultoria
interna da Cativa Operadora.

O cliente final responde o formulário a partir de um link exclusivo do
agente de viagem. Ao concluir, o briefing chega por e-mail ao agente e a
solicitação entra na fila da especialista Disney, que apoia a agência na
montagem da proposta. A especialista fala com a agência, nunca com o
cliente final.

---

## Estrutura

```
disney-expert/
├── lib/
│   └── perguntas.ts        definição única das perguntas do formulário
├── infra/
│   ├── docker-compose.yml  banco, aplicação e proxy
│   ├── Dockerfile          imagem da aplicação
│   ├── Caddyfile           proxy com HTTPS automático
│   ├── .env.example        modelo das variáveis de ambiente
│   ├── backup.sh           backup diário do banco
│   ├── OPERACAO.md         manual do administrador do servidor
│   └── sql/
│       └── schema_disney_expert.sql
└── app/                    interface e API (em construção)
```

---

## Onde começar

Para operar o servidor, leia `infra/OPERACAO.md`.

Para entender o banco, leia os comentários no topo de
`infra/sql/schema_disney_expert.sql`.

Para alterar as perguntas do formulário, edite `lib/perguntas.ts` e suba
a constante `VERSAO_FORMULARIO`. Interface, validação, gravação e
briefing leem todos desse mesmo arquivo.

---

## Dois princípios que não devem ser quebrados

**Gravar antes de distribuir.** Ao receber um envio, a aplicação salva no
banco e só depois dispara e-mail e processa o resto. Se qualquer etapa
posterior falhar, o dado já está guardado e a fila reprocessa. Ninguém
pede ao cliente para preencher tudo de novo.

**Envio de e-mail é idempotente por construção.** A tabela `envios_email`
tem índice único em `idempotency_key`. Insira a linha antes de chamar o
provedor. Se o insert falhar por violação de unicidade, o e-mail já
saiu: não envie de novo.

---

## Ambiente

Copie `infra/.env.example` para `infra/.env` e preencha. O `.env` nunca
vai para o repositório.
