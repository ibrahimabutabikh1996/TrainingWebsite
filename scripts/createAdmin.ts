import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

async function createAdmin() {
  try {
    const username = "admin";
    const password = "Aa123456789@";

    const hashedPassword = await hashPassword(password);
    
    // Check if admin already exists
    const existing = await prisma.accounts.findUnique({
      where: { username }
    });

    if (existing) {
      console.log("Admin account already exists!");
      process.exit(0);
    }

    const adminAccount = await prisma.accounts.create({
      data: {
        username: username,
        password: hashedPassword,
      },
    });

    console.log(`SUCCESS: Admin account created with ID: ${adminAccount.id}`);
  } catch (error) {
    console.error("Error creating admin account:", error);
  } finally {
    process.exit(0);
  }
}

createAdmin();
