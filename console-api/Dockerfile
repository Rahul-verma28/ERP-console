# AHEAD Console API (with its in-process worker). Built from the repository root (docker-compose
# sets the context) because the shared contracts in backend/src/contracts are imported here.
# On start it creates the ahead_console database if missing and applies migrations, then serves on :5100.
FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /repo

# The shared contracts need the backend's packages (zod) to resolve
COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci --omit=dev --ignore-scripts
COPY backend/src/contracts backend/src/contracts

COPY console-api/package.json console-api/package-lock.json console-api/
RUN cd console-api && npm ci
COPY console-api console-api
RUN cd console-api && npx prisma generate

WORKDIR /repo/console-api
ENV NODE_ENV=production PORT=5100 STORAGE_DIR=/data/storage
EXPOSE 5100
VOLUME ["/data/storage"]
CMD ["sh", "-c", "npx tsx scripts/db-prepare.ts && npx tsx src/server.ts"]
