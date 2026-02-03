# Dockerfile for Cloud Run Deployment
# Hardened for production - copies ONLY src/ directory

FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy ONLY modern architecture (src/)
COPY src ./src

# Expose port (Cloud Run uses PORT env var, defaults to 5000)
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server using modern entrypoint
CMD ["node", "src/index.js"]
