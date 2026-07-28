import { prisma } from "../src/lib/db";

async function clearDB() {
  try {
    console.log("Removing account references...");
    await prisma.courses.updateMany({ data: { coach_id: null } });
    await prisma.profiles.updateMany({ data: { user_id: null } });

    console.log("Deleting accounts...");
    const accountsRes = await prisma.accounts.deleteMany({});
    console.log(`Deleted ${accountsRes.count} accounts.`);

    console.log("Deleting profiles (users)...");
    const profilesRes = await prisma.profiles.deleteMany({});
    console.log(`Deleted ${profilesRes.count} profiles.`);

    console.log("SUCCESS");
  } catch (error) {
    console.error("Error clearing DB:", error);
  } finally {
    process.exit(0);
  }
}

clearDB();
