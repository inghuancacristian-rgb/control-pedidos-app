# Guía de Despliegue - Control Pedidos App

## Arquitectura
- **Frontend**: Vercel (React + Vite)
- **Backend**: Railway (Node.js + Express + tRPC)
- **Base de datos**: PlanetScale (MySQL serverless)

---

## 1. PlanetScale (Base de Datos)

1. Crear cuenta en [app.planetscale.com](https://app.planetscale.com)
2. Crear nuevo database cluster
3. Obtener connection string:
   - Settings → Credentials → Copy connection string
   - Formato: `mysql://USER:PASS@HOST.planetscaledb.com/DATABASE?ssl=...`

4. Configurar SSL:
   - PlanetScale usa certificados CA específicos
   - Añadir a connection string: `&ssl-ca=/etc/ssl/certs/ca-certificate.crt`

---

## 2. Railway (Backend)

### Configuración automática
1. Conectar repositorio GitHub en [railway.app](https://railway.app)
2. Seleccionar proyecto → Add New Service → Backend
3. Configurar variables de entorno:

```
DATABASE_URL=mysql://USER:PASS@HOST.planetscaledb.com/DATABASE?ssl=...&ssl-ca=/etc/ssl/certs/ca-certificate.crt
JWT_SECRET=your-secret-min-32-chars
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

### Configuración Manual (Dockerfile)
Si Railway no detecta automáticamente:
- Usar Dockerfile incluido en el repositorio
- O configurar build command: `pnpm build`
- O configurar start command: `node dist/index.js`

### Verificar salud del servicio
- Health check endpoint: `https://your-app.railway.app/api/trpc/health`

---

## 3. Vercel (Frontend)

### Deploy via GitHub
1. Conectar repositorio en [vercel.com](https://vercel.com)
2. Importar proyecto
3. Framework: Vite (detecta automáticamente)
4. Root Directory: `proyecto.claude/control-pedidos-app/client`

### Variables de Entorno en Vercel
```
VITE_API_URL=https://your-backend.railway.app/api/trpc
VITE_WS_URL=wss://your-backend.railway.app
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com (opcional)
VITE_ANALYTICS_WEBSITE_ID=your-umami-id (opcional)
VITE_APP_ID=control-pedidos-app
```

### Configuración (vercel.json)
El archivo `vercel.json` ya está configurado para:
- Proxy de requests `/api/*` hacia Railway
- Usar `pnpm` como package manager
- Build command automático

---

## 4. Migraciones de Base de Datos

### Push schema a PlanetScale
```bash
# Localmente (requiere .env con DATABASE_URL)
cd proyecto.claude/control-pedidos-app
pnpm db:push

# O usando mysql CLI directo
mysql -h HOST.planetscaledb.com -u USER -p DATABASE < drizzle/migrations...
```

---

## 5. Verificación Post-Deploy

1. **Frontend**: https://your-app.vercel.app
2. **Backend API**: https://your-backend.railway.app/api/trpc/health
3. **WebSocket**: wss://your-backend.railway.app (para tracking en tiempo real)

---

## Notas Importantes

### CORS
El backend en Railway ya está configurado para aceptar requests desde cualquier origen en desarrollo. Para producción, asegurar que `VITE_API_URL` esté correctamente configurada en Vercel.

### Uploads de Imágenes
El sistema usa un storage proxy configurable. Para producción, configurar:
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`

O implementar fallback a almacenamiento local (S3, Vercel Blob, etc.)

### WebSocket
Para conexiones en tiempo real (tracking), el backend usa Socket.io. Asegurar que el proxy de Vercel no bloquee conexiones WebSocket (configurado en vercel.json).

---

## Comandos Útiles

```bash
# Desarrollo local
cd proyecto.claude/control-pedidos-app
pnpm dev

# Build producción
pnpm build

# Push schema DB
pnpm db:push
```
