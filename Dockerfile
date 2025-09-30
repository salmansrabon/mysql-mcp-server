FROM node:18-alpine

# Install wget for health checks
RUN apk add --no-cache wget

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001

# Change ownership of the app directory
RUN chown -R mcp:nodejs /app
USER mcp

# Set container mode environment variable
ENV CONTAINER_MODE=true

# Expose port (if needed for health checks)
EXPOSE 5000

# Start the application
CMD ["node", "mysql-mcp-server.js"]
