"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Day } from "@/types/admin";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/* coachId comes from localStorage, so it can be any string. The column is uuid,
   and handing Postgres a non-uuid raises P2007 — caught below, but it costs a
   round trip and buries a real stack trace in the logs. Shape-check first. */
const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function saveCourseAction(data: {
  courseId?: string; // If editing
  name: string;
  description?: string;
  traineeId?: string;
  daysData: Day[];
  coachId?: string;
}) {
  try {
    if (!data.name) {
      return { success: false, error: "اسم الكورس مطلوب" };
    }

    /* coachId is the logged-in account id. This used to be checked against
       auth.users, which this app never populates — so the lookup never matched
       and every course was saved with no coach. courses.coach_id now references
       accounts, so validate against the same table. */
    let validCoachId: string | null = null;
    if (data.coachId && isValidUUID(data.coachId)) {
      try {
        const account = await prisma.accounts.findUnique({
          where: { id: data.coachId },
          select: { id: true },
        });
        if (account) {
          validCoachId = data.coachId;
        }
      } catch (err) {
        console.error("Coach ID validation failed:", err);
      }
    }

    let savedCourse;

    /* Normalised so an empty textbox clears the column instead of storing "". */
    const description = data.description?.trim() ? data.description.trim() : null;

    if (data.courseId) {
      // Update existing course
      savedCourse = await prisma.courses.update({
        where: { id: data.courseId },
        data: {
          name: data.name,
          description,
          days_data: data.daysData,
        },
      });
    } else {
      // Create new course
      savedCourse = await prisma.courses.create({
        data: {
          name: data.name,
          description,
          days_data: data.daysData,
          coach_id: validCoachId,
        },
      });
    }

    // If traineeId is provided, assign the course to the trainee
    if (data.traineeId) {
      /* All three writes commit together. Run separately, a failure partway
         left profiles.current_course_id pointing at a course with no active
         client_courses row, and nothing ever resynced the two. */
      await prisma.$transaction([
        prisma.client_courses.updateMany({
          where: { client_id: data.traineeId, is_active: true },
          data: { is_active: false },
        }),
        prisma.profiles.update({
          where: { id: data.traineeId },
          data: { current_course_id: savedCourse.id },
        }),
        prisma.client_courses.create({
          data: {
            client_id: data.traineeId,
            course_id: savedCourse.id,
            is_active: true,
          },
        }),
      ]);
    }

    // Revalidate paths to refresh cache
    revalidatePath("/admin/courses");
    revalidatePath("/admin/builder");

    return { success: true, courseId: savedCourse.id };
  } catch (error) {
    console.error("Failed to save course:", error);
    return { success: false, error: errorMessage(error, "حدث خطأ أثناء حفظ الكورس") };
  }
}

export async function deleteCourseAction(courseId: string) {
  try {
    /* Detach, unlink and delete atomically: if the final delete failed after
       the first two ran, trainees silently lost their programme while the
       course stayed in the library. */
    await prisma.$transaction([
      prisma.profiles.updateMany({
        where: { current_course_id: courseId },
        data: { current_course_id: null },
      }),
      prisma.client_courses.deleteMany({ where: { course_id: courseId } }),
      prisma.courses.delete({ where: { id: courseId } }),
    ]);

    revalidatePath("/admin/courses");
    revalidatePath("/admin/builder");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete course:", error);
    return { success: false, error: errorMessage(error, "حدث خطأ أثناء حذف الكورس") };
  }
}

export async function assignCourseAction(courseId: string, traineeId: string) {
  try {
    /* Deactivate, repoint the profile and link the new course as one unit —
       a partial failure here used to desync the two records permanently. */
    await prisma.$transaction([
      prisma.client_courses.updateMany({
        where: { client_id: traineeId, is_active: true },
        data: { is_active: false },
      }),
      prisma.profiles.update({
        where: { id: traineeId },
        data: { current_course_id: courseId },
      }),
      prisma.client_courses.create({
        data: {
          client_id: traineeId,
          course_id: courseId,
          is_active: true,
        },
      }),
    ]);

    revalidatePath("/admin/courses");
    revalidatePath("/admin/builder");

    return { success: true };
  } catch (error) {
    console.error("Failed to assign course:", error);
    return { success: false, error: errorMessage(error, "حدث خطأ أثناء تعيين الكورس") };
  }
}
