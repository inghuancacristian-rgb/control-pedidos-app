import { getDb } from "./server/db";
import { sessions, users } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function checkSessions() {
  try {
    const db = await getDb();
    if (!db) {
      console.log("Database not available");
      process.exit(1);
    }
    const allSessions = await db.select().from(sessions);
    console.log("Active Sessions:", JSON.stringify(allSessions, null, 2));
    
    for (const session of allSessions) {
      const user = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
      console.log(`Session ${session.id} belongs to user:`, user[0]?.username);
    }
  } catch (error) {
    console.error("Error checking sessions:", error);
  } finally {
    process.exit();
  }
}

checkSessions();
