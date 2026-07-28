import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function clearSystem() {
  try {
    console.log("--- Clearing Database (Custom Accounts) ---");
    await prisma.courses.updateMany({ data: { coach_id: null } });
    await prisma.profiles.updateMany({ data: { user_id: null } });

    const accountsRes = await prisma.accounts.deleteMany({});
    console.log(`Deleted ${accountsRes.count} accounts from public.accounts.`);

    const profilesRes = await prisma.profiles.deleteMany({});
    console.log(`Deleted ${profilesRes.count} profiles from public.profiles.`);

    console.log("\n--- Clearing Supabase Auth Users ---");
    if (!supabaseUrl || !supabaseServiceKey) {
        console.log("No Supabase URL or Service Key found, skipping Supabase Auth clearing.");
    } else {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });

        if (error) {
          console.error("Error fetching Supabase Auth users:", error.message);
        } else if (data.users && data.users.length > 0) {
          console.log(`Found ${data.users.length} users in Supabase Auth.`);
          let deletedCount = 0;
          for (const user of data.users) {
            const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
            if (delErr) {
              console.error(`Failed to delete user ${user.email || user.id}:`, delErr.message);
            } else {
              deletedCount++;
              console.log(`Deleted Supabase user: ${user.email || user.id}`);
            }
          }
          console.log(`Successfully deleted ${deletedCount} users from Supabase Auth.`);
        } else {
          console.log("No users found in Supabase Auth.");
        }
    }

    try {
        const authUsersRes = await prisma.users.deleteMany({});
        console.log(`Deleted ${authUsersRes.count} residual records from auth.users via Prisma.`);
    } catch(e) {
        console.log("Could not delete from auth.users via Prisma directly (often restricted by Supabase), skipping.");
    }

    console.log("\n--- System Fully Emptied ---");
  } catch (error) {
    console.error("Error clearing system:", error);
  } finally {
    process.exit(0);
  }
}

clearSystem();
