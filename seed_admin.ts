import { getUserByUsername, createUser } from "./server/db";
import { hashPassword } from "./server/auth";

async function seedAdmin() {
  try {
    const existing = await getUserByUsername("admin");
    if (existing) {
      console.log("Admin user already exists");
    } else {
      const passwordHash = await hashPassword("admin123");
      await createUser({
        username: "admin",
        passwordHash,
        name: "Administrador",
        email: "admin@demo.com",
        role: "admin",
        openId: "demo_admin",
        loginMethod: "traditional",
      });
      console.log("Admin user created successfully");
    }
  } catch (error) {
    console.error("Error seeding admin:", error);
  } finally {
    process.exit();
  }
}

seedAdmin();
