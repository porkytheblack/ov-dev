FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/shared-ts/package.json ./packages/shared-ts/
COPY services/ov-agent/package.json ./services/ov-agent/
RUN pnpm install --frozen-lockfile=false --ignore-scripts

FROM deps AS build
COPY packages/schemas ./packages/schemas
COPY packages/shared-ts ./packages/shared-ts
COPY services/ov-agent ./services/ov-agent

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable
COPY --from=build /app /app
WORKDIR /app/services/ov-agent
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
