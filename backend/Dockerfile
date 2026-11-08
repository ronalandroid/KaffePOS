FROM node:20-alpine AS build
WORKDIR /app
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  && node -e "const fs=require('fs'); const m=fs.readFileSync('dist/payments/providers/mayar.provider.js','utf8'); if(!m.includes('MayarPaymentProvider') || !m.includes('/hl/v2')) { console.error('Mayar provider build output is stale.'); process.exit(1); }"

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY scripts ./scripts

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT:-8787}/health" >/dev/null || exit 1
CMD ["sh", "-c", "node scripts/run-migrations.mjs && node dist/index.js"]
