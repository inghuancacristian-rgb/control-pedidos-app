# =============================================================================
# Railway Dockerfile - Backend Node.js
# =============================================================================

# Usar imagen con Node.js 20 LTS
FROM node:20-alpine AS base

# Instalar pnpm globalmente
FROM base AS deps
RUN npm install -g pnpm

WORKDIR /app

# Copiar solo archivos necesarios para instalar dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY --from=source ./.npmrc ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Build stage
FROM deps AS build
COPY . .
RUN pnpm build

# Production stage
FROM base AS production
WORKDIR /app

# Copiar dependencias instaladas y archivos de producción
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Crear directorio para uploads
RUN mkdir -p /app/uploads

# Exponer puerto
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/trpc/health || exit 1

# Iniciar servidor
CMD ["node", "dist/index.js"]
