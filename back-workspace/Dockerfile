# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1: Base image
# =============================================================================
FROM node:22-alpine AS base
WORKDIR /usr/src/app

# =============================================================================
# Stage 2: Dependencies (development & build)
# =============================================================================
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

# =============================================================================
# Stage 3: Development target (live-reload with mounted source)
# =============================================================================
FROM dependencies AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# =============================================================================
# Stage 4: Builder (compiles TypeScript to dist/)
# =============================================================================
FROM dependencies AS builder
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# =============================================================================
# Stage 5: Production target (lean, secure, non-root)
# =============================================================================
FROM node:22-alpine AS production
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Install curl for docker healthcheck
RUN apk add --no-cache curl

# Configure non-root user
USER node

# Copy only production dependencies and compiled build
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "dist/main.js"]
