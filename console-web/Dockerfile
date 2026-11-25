# AHEAD Console web app. Built from the repository root (docker-compose sets the context) because
# the shared contracts in backend/src/contracts are imported by the app.
FROM node:22-alpine AS build
WORKDIR /repo

COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci --omit=dev --ignore-scripts
COPY backend/src/contracts backend/src/contracts

COPY console-web/package.json console-web/package-lock.json console-web/
RUN cd console-web && npm ci
COPY console-web console-web
# Where console-api is: the browser's /api/v1 requests are passed to it by this web server
ARG CONSOLE_API_URL=http://console-api:5100
# The ERP website (sign-up links with a referral code); baked into the browser code at build time
ARG WEBSITE_URL=http://localhost:3000
ENV CONSOLE_API_URL=$CONSOLE_API_URL NEXT_PUBLIC_WEBSITE_URL=$WEBSITE_URL NEXT_TELEMETRY_DISABLED=1
RUN cd console-web && npm run build

FROM node:22-alpine
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/console-web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
EXPOSE 3001
CMD ["npm", "start"]
