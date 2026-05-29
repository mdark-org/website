ARG NODE_VERSION=24.13.0-slim

FROM node:${NODE_VERSION} AS builder

ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY . .

RUN corepack enable pnpm && pnpm install --config.minimum-release-age=0 --no-frozen-lockfile;

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable pnpm && pnpm build

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/fuma/.next/standalone ./

COPY --from=builder --chown=node:node /app/fuma/public ./fuma/public
COPY --from=builder --chown=node:node /app/fuma/.next/static ./fuma/.next/static

RUN mkdir -p ./fuma/.next
RUN chown node:node ./fuma/.next

USER node

EXPOSE 8080

CMD ["node", "fuma/server.js"]