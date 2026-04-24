import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Obtener clave de encriptación del entorno
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // Si no hay clave configurada, usar una clave derivada de otras variables
    const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || "default-secret-change-me";
    return crypto.createHash("sha256").update(secret).digest();
  }
  // La clave debe ser exactamente 32 bytes para aes-256
  return crypto.createHash("sha256").update(key).digest();
}

// Cifrar texto
export function encrypt(text: string): string {
  if (!text) return text;

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  // Formato: iv:tag:encrypted
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

// Descifrar texto
export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(":")) return encryptedText;

  try {
    const [ivHex, tagHex, encrypted] = encryptedText.split(":");

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Error descifrando datos:", error);
    return encryptedText;
  }
}

// Cifrar objeto (para campos sensibles en JSON)
export function encryptFields<T extends Record<string, any>>(
  data: T,
  fields: string[]
): T {
  const result = { ...data };
  for (const field of fields) {
    if (result[field]) {
      result[field] = encrypt(result[field]);
    }
  }
  return result;
}

// Descifrar objeto
export function decryptFields<T extends Record<string, any>>(
  data: T,
  fields: string[]
): T {
  const result = { ...data };
  for (const field of fields) {
    if (result[field]) {
      result[field] = decrypt(result[field]);
    }
  }
  return result;
}

// Encriptar teléfono
export function encryptPhone(phone: string): string {
  return encrypt(phone);
}

// Desencriptar teléfono
export function decryptPhone(encryptedPhone: string): string {
  return decrypt(encryptedPhone);
}

// Encriptar email
export function encryptEmail(email: string): string {
  return encrypt(email);
}

// Desencriptar email
export function decryptEmail(encryptedEmail: string): string {
  return decrypt(encryptedEmail);
}

// Hash simple para comparación (sin sal para datos no críticos)
export function simpleHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// Generar token aleatorio seguro
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

// Verificar si un texto está encriptado
export function isEncrypted(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return text.includes(":") && text.split(":").length === 3;
}