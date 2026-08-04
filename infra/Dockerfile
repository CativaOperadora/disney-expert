# =====================================================================
# Imagem da aplicação Next.js, em três estágios para ficar pequena.
#
# Exige "output: 'standalone'" no next.config.js, senão o estágio final
# não encontra o server.js.
# =====================================================================

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Diretório dos anexos, criado JÁ com o dono certo.
#
# Ao inicializar um volume nomeado vazio, o Docker copia dono e permissão
# do caminho correspondente NA IMAGEM. Sem este mkdir o caminho não existe,
# o volume nasce root e a aplicação — que roda como nextjs (uid 1001) —
# não consegue gravar. Era isso que quebrava o envio de foto e os anexos
# da venda perdida em produção.
#
# Volume que JÁ existe não é reinicializado. Para corrigir um servidor em
# funcionamento, uma vez só:
#   docker compose exec -u 0 app chown -R 1001:1001 /dados/anexos
RUN mkdir -p /dados/anexos && chown -R nextjs:nodejs /dados

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
