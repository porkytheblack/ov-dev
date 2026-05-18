FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/shared-ts/package.json ./packages/shared-ts/
COPY services/ov-telegram/package.json ./services/ov-telegram/
RUN pnpm install --frozen-lockfile=false --ignore-scripts

FROM deps AS build
COPY packages/schemas ./packages/schemas
COPY packages/shared-ts ./packages/shared-ts
COPY services/ov-telegram ./services/ov-telegram

FROM node:20-alpine AS runtime
WORKDIR /app
# ffmpeg: camera clips are MPEG-4 Part 2 which Telegram's player renders as
# a white frame — transcode to H.264 before upload.
RUN apk add --no-cache ffmpeg && corepack enable
COPY --from=build /app /app
WORKDIR /app/services/ov-telegram
ENV NODE_ENV=production
CMD ["pnpm", "start"]
