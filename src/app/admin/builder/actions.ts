"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function saveCourseAction(data: {
  courseId?: string; // If editing
  name: string;
  description?: string;
  traineeId?: string;
  daysData: any; // the weeks array
  coachId?: string;
}) {
  try {
    if (!data.name) {
      return { success: false, error: "اسم الكورس مطلوب" };
    }

    // Validate if the coachId is a valid UUID in the auth.users table
    let validCoachId: string | null = null;
    if (data.coachId) {
      try {
        const userExists = await prisma.users.findUnique({
          where: { id: data.coachId },
        });
        if (userExists) {
          validCoachId = data.coachId;
        }
      } catch (err) {
        console.error("Coach ID validation failed:", err);
      }
    }

    let savedCourse;

    if (data.courseId) {
      // Update existing course
      savedCourse = await prisma.courses.update({
        where: { id: data.courseId },
        data: {
          name: data.name,
          days_data: data.daysData,
        },
      });
    } else {
      // Create new course
      savedCourse = await prisma.courses.create({
        data: {
          name: data.name,
          days_data: data.daysData,
          coach_id: validCoachId,
        },
      });
    }

    // If traineeId is provided, assign the course to the trainee
    if (data.traineeId) {
      // First, unassign any existing course assignments for this trainee in client_courses (set active = false)
      await prisma.client_courses.updateMany({
        where: { client_id: data.traineeId, is_active: true },
        data: { is_active: false },
      });

      // Update trainee profile
      await prisma.profiles.update({
        where: { id: data.traineeId },
        data: {
          current_course_id: savedCourse.id,
        },
      });

      // Create new client_courses relation
      await prisma.client_courses.create({
        data: {
          client_id: data.traineeId,
          course_id: savedCourse.id,
          is_active: true,
        },
      });
    }

    // Revalidate paths to refresh cache
    revalidatePath("/admin/courses");
    revalidatePath("/admin/builder");

    return { success: true, courseId: savedCourse.id };
  } catch (error: any) {
    console.error("Failed to save course:", error);
    return { success: false, error: error.message || "حدث خطأ أثناء حفظ الكورس" };
  }
}

export async function deleteCourseAction(courseId: string) {
  try {
    // 1. Safe disconnect: Set current_course_id = null for any profiles using this course
    await prisma.profiles.updateMany({
      where: { current_course_id: courseId },
      data: { current_course_id: null },
    });

    // 2. Delete any matching client_courses relation entries
    await prisma.client_courses.deleteMany({
      where: { course_id: courseId },
    });

    // 3. Delete the course itself
    await prisma.courses.delete({
      where: { id: courseId },
    });

    revalidatePath("/admin/courses");
    revalidatePath("/admin/builder");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete course:", error);
    return { success: false, error: error.message || "حدث خطأ أثناء حذف الكورس" };
  }
}

export async function assignCourseAction(courseId: string, traineeId: string) {
  try {
    // First, deactivate any active courses for this trainee
    await prisma.client_courses.updateMany({
      where: { client_id: traineeId, is_active: true },
      data: { is_active: false },
    });

    // Update trainee profile
    await prisma.profiles.update({
      where: { id: traineeId },
      data: {
        current_course_id: courseId,
      },
    });

    // Create a new client_courses link
    await prisma.client_courses.create({
      data: {
        client_id: traineeId,
        course_id: courseId,
        is_active: true,
      },
    });

    revalidatePath("/admin/courses");
    revalidatePath("/admin/builder");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to assign course:", error);
    return { success: false, error: error.message || "حدث خطأ أثناء تعيين الكورس" };
  }
}
