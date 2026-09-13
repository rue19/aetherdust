# -- build stage --
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/policy-engine/package.json packages/policy-engine/
COPY packages/preflight/package.json packages/preflight/
COPY packages/midnight/package.json packages/midnight/
COPY packages/sponsor/package.json packages/sponsor/
COPY packages/database/package.json packages/database/
COPY packages/api/package.json packages/api/

RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/policy-engine/tsconfig.json packages/policy-engine/
COPY packages/policy-engine/src packages/policy-engine/src
COPY packages/preflight/tsconfig.json packages/preflight/
COPY packages/preflight/src packages/preflight/src
COPY packages/midnight/tsconfig.json packages/midnight/
COPY packages/midnight/src packages/midnight/src
COPY packages/sponsor/tsconfig.json packages/sponsor/
COPY packages/sponsor/src packages/sponsor/src
COPY packages/database/tsconfig.json packages/database/
COPY packages/database/src packages/database/src
COPY packages/api/tsconfig.json packages/api/
COPY packages/api/src packages/api/src

RUN npm run build

# -- production stage --
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/policy-engine/package.json packages/policy-engine/
COPY packages/preflight/package.json packages/preflight/
COPY packages/midnight/package.json packages/midnight/
COPY packages/sponsor/package.json packages/sponsor/
COPY packages/database/package.json packages/database/
COPY packages/api/package.json packages/api/

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/packages/policy-engine/dist packages/policy-engine/dist
COPY --from=builder /app/packages/preflight/dist packages/preflight/dist
COPY --from=builder /app/packages/midnight/dist packages/midnight/dist
COPY --from=builder /app/packages/sponsor/dist packages/sponsor/dist
COPY --from=builder /app/packages/database/dist packages/database/dist
COPY --from=builder /app/packages/api/dist packages/api/dist

RUN addgroup -g 1001 -S aetherdust && \
    adduser -S aetherdust -u 1001 -G aetherdust
USER aetherdust

EXPOSE 3000
CMD ["node", "packages/api/dist/main.js"]
