FROM bluenviron/mediamtx:latest AS mediamtx-src

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
RUN apk add --no-cache ca-certificates
COPY --from=mediamtx-src /mediamtx /usr/local/bin/mediamtx

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/shared-ts/package.json ./packages/shared-ts/
COPY services/ov-stream-gateway/package.json ./services/ov-stream-gateway/
RUN pnpm install --frozen-lockfile=false --ignore-scripts

FROM deps AS build
COPY packages/schemas ./packages/schemas
COPY packages/shared-ts ./packages/shared-ts
COPY services/ov-stream-gateway ./services/ov-stream-gateway

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable
# ffmpeg is required by mediamtx's runOnDemand transcoding (HEVC → H.264 for
# browser-playable HLS).
RUN apk add --no-cache ca-certificates ffmpeg
COPY --from=mediamtx-src /mediamtx /usr/local/bin/mediamtx
COPY --from=build /app /app
WORKDIR /app/services/ov-stream-gateway
ENV NODE_ENV=production
EXPOSE 8889 8554 8888 8989
CMD ["pnpm", "start"]
