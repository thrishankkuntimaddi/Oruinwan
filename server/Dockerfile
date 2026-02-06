# Dockerfile for Cloud Run Deployment
# Uses canonical server.js entrypoint

FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy all required production code
COPY server.js ./
COPY socket.js ./
COPY socket ./socket
COPY config ./config
COPY constants ./constants
COPY middleware ./middleware
COPY models ./models
COPY routes ./routes
COPY utils ./utils

# Expose port (Cloud Run uses PORT env var, defaults to 8080)
EXPOSE 8080

# Health check using environment-aware port
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8080; require('http').get(\`http://localhost:\${port}/api/health\`, (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server using canonical entrypoint
CMD ["node", "server.js"]
