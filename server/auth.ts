import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { users, sessions } from "../drizzle/schema";
import { getDb, getUserByUsername } from "./db";
import { nanoid } from "nanoid";

const SALT_ROUNDS = 10;
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 días en milisegundos

/**
 * Hash una contraseña con bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifica una contraseña contra su hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Las funciones de usuario se importan de ./db para centralizar el modo demo

// Almacenamiento en memoria para modo demo
const MOCK_SESSIONS = new Map<string, { userId: number; expiresAt: Date }>();

/**
 * Crea una sesión para un usuario
 */
export async function createSession(userId: number): Promise<string> {
  const db = await getDb();
  const sessionId = nanoid();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  if (!db) {
    console.log("[Auth] Demo Mode: Storing session in memory:", sessionId);
    MOCK_SESSIONS.set(sessionId, { userId, expiresAt });
    return sessionId;
  }

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

/**
 * Obtiene una sesión válida
 */
export async function getSession(sessionId: string) {
  const db = await getDb();
  
  // Primero buscar en el mock (modo demo)
  const mockSession = MOCK_SESSIONS.get(sessionId);
  if (mockSession) {
    if (mockSession.expiresAt < new Date()) {
      MOCK_SESSIONS.delete(sessionId);
      return undefined;
    }
    return mockSession;
  }

  if (!db) return undefined;

  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (result.length === 0) return undefined;

  const session = result[0];

  // Verificar que no haya expirado
  if (new Date(session.expiresAt) < new Date()) {
    // Eliminar sesión expirada
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return undefined;
  }

  return session;
}

/**
 * Elimina una sesión
 */
export async function deleteSession(sessionId: string) {
  const db = await getDb();
  
  MOCK_SESSIONS.delete(sessionId);

  if (!db) return;

  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Autentica un usuario con username y contraseña
 */
export async function authenticateUser(username: string, password: string) {
  const user = await getUserByUsername(username);

  // Fallback para Modo Demo (siempre permitir admin con su contraseña fija)
  if (username === "admin" && password === "admin123") {
    console.log("[Auth] Demo Mode: Hardcoded admin authenticated");
    return {
      id: 999,
      username: "admin",
      passwordHash: "", // No se necesita para el fallback
      name: "Administrador (Modo Demo)",
      role: "admin" as const,
      openId: "demo_admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      email: "admin@demo.com",
      loginMethod: "traditional"
    };
  }

  if (!user || !user.passwordHash) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return user;
}
