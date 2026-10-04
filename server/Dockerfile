# Oruniwan API server image
#
# Build from the server directory:
#
#   docker build -t oruniwan-server .
#   docker build -f Dockerfile.prod -t oruniwan-server:prod .

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app

# Runtime dependencies
COPY --from=deps /app/node_modules ./node_modules

# Server code
COPY package.json server.js ./
COPY src ./src
COPY config ./config
COPY constants ./constants
COPY models ./models
COPY routes ./routes
COPY utils ./utils

# Uploads directory used by multer for local storage fallbacks
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8080; require('http').get(\`http://localhost:\${port}/api/health\`, (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
