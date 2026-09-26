# Oruinwan API server image.
#
# Build from the REPOSITORY ROOT so the sibling ai/ and platform/ folders that
# the server requires at runtime are included:
#
#   docker build -f server/Dockerfile -t chttrix-server .
#
# Cloud Run / Railway: set the Docker context to the repo root and the
# Dockerfile path to server/Dockerfile.

FROM node:20-slim AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --workspaces=false && npm cache clean --force

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app

# Runtime dependencies for the server (ai/ resolves the Gemini SDK from here too).
COPY --from=deps /app/server/node_modules ./server/node_modules

# Server code
COPY server/package.json ./server/
COPY server/server.js ./server/
COPY server/src ./server/src
COPY server/config ./server/config
COPY server/constants ./server/constants
COPY server/models ./server/models
COPY server/routes ./server/routes
COPY server/utils ./server/utils

# Sibling packages the server requires with relative paths.
COPY ai ./ai
COPY platform ./platform

# Uploads directory used by multer for local storage fallbacks.
RUN mkdir -p /app/server/uploads && chown -R node:node /app
USER node

WORKDIR /app/server
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8080; require('http').get(\`http://localhost:\${port}/api/health\`, (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
