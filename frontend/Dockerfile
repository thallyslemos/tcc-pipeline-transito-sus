# syntax=docker/dockerfile:1
#
# Build: docker build -t transito-sus-web -f frontend/Dockerfile frontend
# Run:   docker run -p 3000:3000 -e API_URL=https://api.exemplo.com transito-sus-web
#
# API_URL e lida em RUNTIME pelo endpoint /runtime-config (window.__API_URL__).
# Nao embutir a URL da API no build — a mesma imagem serve local, Cloud Run, etc.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0 API_URL=http://localhost:8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
