import express from "express";
import fs from "fs/promises";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import superjson from "superjson";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initWebSocket } from "./websocket";

// Configurar logger con pino
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});

// Reemplazar console.log con logger
console.log = (...args) => logger.info(...args);
console.error = (...args) => logger.error(...args);
console.warn = (...args) => logger.warn(...args);

// Configurar rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 solicitudes por IP
  message: { error: "Demasiadas solicitudes, por favor intente más tarde" },
  standardHeaders: true,
  legacyHeaders: false,
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function saveUploadedFileLocally(fileName: string, buffer: Buffer) {
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const fullPath = path.join(uploadsDir, fileName);
  await fs.writeFile(fullPath, buffer);
  return `/uploads/${fileName}`;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const uploadsDir = path.resolve(process.cwd(), "uploads");

  // Inicializar WebSocket
  initWebSocket(server);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/uploads", express.static(uploadsDir));

  // Aplicar rate limiting a todas las rutas API
  app.use("/api", limiter);
  
  // Configurar multer para upload de imágenes
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos de imagen'));
      }
    }
  });
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Image upload endpoint
  app.post("/api/upload-image", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }
      
      const extension = req.file.mimetype.split('/')[1] || 'jpg';
      const fileName = `product-${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
      
      let url: string;

      try {
        const { storagePut } = await import("../storage");
        const uploaded = await storagePut(fileName, req.file.buffer, req.file.mimetype);
        url = uploaded.url;
      } catch (error) {
        console.warn("Falling back to local upload storage:", error);
        url = await saveUploadedFileLocally(fileName, req.file.buffer);
      }
      
      res.json({ url, success: true });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Error al subir la imagen" });
    }
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      transformer: superjson,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3001");
  console.log(`[Server] Preferred port: ${preferredPort}`);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
