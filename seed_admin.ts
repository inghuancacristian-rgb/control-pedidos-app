import { createUser, getUserByUsername } from "./server/auth";

async function seedAdmin() {
  try {
    const existing = await getUserByUsername("admin");
    if (existing) {
      console.log("Admin user already exists");
    } else {
      await createUser("admin", "admin123", "Administrador", "admin");
      console.log("Admin user created successfully");
    }
  } catch (error) {
    console.error("Error seeding admin:", error);
  } finally {
    process.exit();
  }
}

seedAdmin();
