# ── Frontend Dockerfile — Next.js 16 standalone build ────────────────────
# Stage 1: install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Stage 2: build the Next.js app
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# We need a JWT_SECRET at build time only because middleware references
# process.env.JWT_SECRET; build with a placeholder, it is replaced at runtime.
ENV JWT_SECRET=build-only-placeholder
RUN npm run build

# Stage 3: tiny runtime image
FROM node:20-alpine AS runner
WORKDIR /app
# HOSTNAME=:: lets the Next standalone server accept both IPv6 (Railway's
# edge/private network) and IPv4 (local docker-compose) connections. PORT is
# overridden at runtime by the platform ($PORT) when present.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=::

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
