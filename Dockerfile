# Oruinwan in one image: the API server (with the AI module and database migrations) and the
# web app it serves, on one origin. Build from the repository root:
#
#   docker build -t oruinwan .
#   docker compose --profile app up -d --build    # with PostgreSQL, Redis and S3 (docker-compose.yml)
#
# Configuration comes from the environment at run time (see server/.env.example). The web app
# talks to the server it is loaded from, so the same image works on any domain. To offer
# Google sign-in, build with --build-arg VITE_GOOGLE_CLIENT_ID=<client id>.

# ---- web app ----------------------------------------------------------------------------
FROM node:22-slim AS web
WORKDIR /app
COPY package.json yarn.lock ./
COPY client/package.json client/
COPY server/package.json server/
COPY e2e/package.json e2e/
RUN yarn install --frozen-lockfile --ignore-scripts --network-timeout 600000
COPY postcss.config.js ./
COPY platform platform
COPY client client
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN yarn workspace client build

# ---- server dependencies (production only, versions from yarn.lock) ---------------------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY server/package.json server/
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.workspaces=['server'];fs.writeFileSync('package.json',JSON.stringify(p))" \
 && yarn install --production --pure-lockfile --ignore-scripts --network-timeout 600000 \
 && mkdir -p server/node_modules \
 && yarn cache clean

# ---- runtime ----------------------------------------------------------------------------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY ai ./ai
COPY platform ./platform
COPY server ./server
COPY --from=web /app/dist ./dist
RUN mkdir -p server/uploads && chown -R node:node server/uploads
USER node
WORKDIR /app/server

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||8080)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
