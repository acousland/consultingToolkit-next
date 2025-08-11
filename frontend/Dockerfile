# Use official Node.js image for Next.js
## syntax=docker/dockerfile:1.6
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
	npm ci --no-audit --no-fund

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure API base URL targets the docker service during build time
ENV NEXT_PUBLIC_API_BASE_URL=http://api:8000
RUN --mount=type=cache,target=/root/.npm \
	npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Expose default Next.js port
EXPOSE 3000
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public
# Only production node_modules (prune) + build output copied last (smaller layer churn)
COPY --from=builder /app/.next ./.next
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --production --no-audit --no-fund || true
CMD ["node", "node_modules/next/dist/bin/next", "start"]
