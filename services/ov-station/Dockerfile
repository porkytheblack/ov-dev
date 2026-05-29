FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/shared-ts/package.json ./packages/shared-ts/
COPY packages/ai-ts/package.json ./packages/ai-ts/
COPY services/ov-station/package.json ./services/ov-station/
RUN pnpm install --frozen-lockfile=false --ignore-scripts

FROM deps AS build
COPY packages/schemas ./packages/schemas
COPY packages/shared-ts ./packages/shared-ts
COPY packages/ai-ts ./packages/ai-ts
COPY services/ov-station ./services/ov-station

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable
# ffmpeg/ffprobe: upload-clip-to-r2 re-encodes each incident clip to fit the
# vision model's payload budget before R2 upload (see src/fit-video.ts).
RUN apk add --no-cache ffmpeg
COPY --from=build /app /app
WORKDIR /app/services/ov-station
ENV NODE_ENV=production
CMD ["pnpm", "start"]
