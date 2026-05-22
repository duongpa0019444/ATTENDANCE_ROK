# ── Stage 1: Install all deps (including dev) ──────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy source & generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# ── Stage 2: Production runtime ────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

# Production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output + Prisma client
COPY --from=builder /app/dist                    ./dist
COPY --from=builder /app/node_modules/.prisma    ./node_modules/.prisma
COPY prisma ./prisma/

EXPOSE 3002

CMD ["node", "dist/main"]
