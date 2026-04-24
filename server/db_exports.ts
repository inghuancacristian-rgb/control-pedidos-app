// Re-exportaciones de tablas y funciones para uso en routers
// Esto permite evitar problemas de importación circular

export { db, getDb } from "./db.js";

export * from "../drizzle/schema.js";