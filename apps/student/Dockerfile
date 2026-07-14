FROM node:22-alpine AS base

# ── Install deps from monorepo root ──────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/student/package.json ./apps/student/
COPY apps/admin/package.json ./apps/admin/
COPY shared/ ./shared/
RUN npm ci

# ── Build ─────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN npm run build --workspace=apps/student

# ── Runtime ───────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/student/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/student/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/student/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
