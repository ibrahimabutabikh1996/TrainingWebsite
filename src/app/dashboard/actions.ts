"use server";

import { prisma } from "@/lib/db";
import { requireUserAction, sessionOwnsProfile } from "@/lib/authGuard";
import { revalidatePath } from "next/cache";

export async function saveWeightLog(
  profileId: string,
  date: string,
  weight: number
): Promise<{ success: boolean; error?: string }> {
  /* The trainee's own weight, or one the coach is recording for them — and
     nobody else's. The profile id used to be taken on trust, so any caller
     could write numbers into any trainee's log. */
  const session = await requireUserAction();
  if (!session) return { success: false, error: "يجب تسجيل الدخول" };
  if (!(await sessionOwnsProfile(session, profileId))) {
    return { success: false, error: "غير مصرح لك بهذا الإجراء" };
  }

  try {
    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { data: true },
    });

    if (!profile) return { success: false, error: "لم يتم العثور على المتدرب" };

    const currentData = typeof profile.data === "string" ? JSON.parse(profile.data) : (profile.data || {});
    const weightLogs = currentData.weightLogs || [];

    // Check if a log for this date already exists and update it, or add a new one
    const existingIndex = weightLogs.findIndex((log: any) => log.date === date);
    if (existingIndex >= 0) {
      weightLogs[existingIndex].weight = weight;
    } else {
      weightLogs.push({ date, weight });
      // Sort by date ascending
      weightLogs.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    const newData = { ...currentData, weightLogs };

    await prisma.profiles.update({
      where: { id: profileId },
      data: { data: newData },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/admin/profile/${profileId}`);

    return { success: true };
  } catch (error) {
    console.error("Error saving weight log:", error);
    return { success: false, error: "حدث خطأ أثناء حفظ الوزن" };
  }
}
