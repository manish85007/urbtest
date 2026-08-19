FROM node:20-bookworm-slim AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @urb-tectrack/shared build \
  && pnpm --filter @urb-tectrack/api exec prisma generate \
  && VITE_API_URL= pnpm --filter @urb-tectrack/web build \
  && pnpm --filter @urb-tectrack/api build

FROM node:20-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3001 \
    WEB_DIST=/app/apps/web/dist
# COOKIE_SECURE, UAT_SEED, EMAIL_PROVIDER, SESSION_SECRET and DATABASE_URL
# must be supplied at runtime via environment injection (docker run -e / compose env_file / ECS secrets).
# Do NOT set insecure defaults here.
COPY --from=build /app /app
RUN pnpm --filter @urb-tectrack/api exec prisma generate
EXPOSE 3001
CMD ["node", "docker-entrypoint.mjs"]
