FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/shared-ts/package.json ./packages/shared-ts/
COPY services/ov-whatsapp/package.json ./services/ov-whatsapp/
RUN pnpm install --frozen-lockfile=false --ignore-scripts

FROM deps AS build
COPY packages/schemas ./packages/schemas
COPY packages/shared-ts ./packages/shared-ts
COPY services/ov-whatsapp ./services/ov-whatsapp

FROM node:20-alpine AS runtime
WORKDIR /app
# ffmpeg: camera clips are MPEG-4 Part 2; transcode to H.264 before upload
# so WhatsApp's player can decode them (same constraint as Telegram).
RUN apk add --no-cache ffmpeg && corepack enable
COPY --from=build /app /app
WORKDIR /app/services/ov-whatsapp
ENV NODE_ENV=production
EXPOSE 3010
CMD ["pnpm", "start"]
