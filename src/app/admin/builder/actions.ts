"use server";

import { prisma } from "@/lib/db";
import { requireAdminAction } from "@/lib/authGuard";
import { revalidatePath } from "next/cache";
import { asDays, type Day } from "@/types/admin";

/* A server action is a public HTTP endpoint however it reads at the call site.
   Being reachable only from a page behind the proxy is not a check — the action
   itself is addressable, and nothing about the page it was called from travels
   with the request. Each one asks for itself. */

const DENIED = { success: false as const, error: "غير مصرح لك بهذا الإجراء" };

/**
 * The message the caller gets — which is the fallback, always.
 *
 * This used to return `error.message` whenever there was one, making these three
 * actions the only place in the panel that hands a raw exception back. A Prisma
 * error names the model, the column and the constraint; the codebase's own note
 * on /api/dump-exercises spells out why that is not something an error response
 * should teach. The detail is logged at the call site, where it is useful.
 */
function errorMessage(error: unknown, fallback: string) {
  console.error(fallback, error);
  return fallback;
}

/* ------------------------------------------------------------------ *
 * Copies
 * ------------------------------------------------------------------ *
 *
 * A course in the library is a template, and reusing one now means taking a
 * copy of it rather than pointing a second trainee at the same row.
 *
 * The distinction is the whole point. `courses.days_data` is one jsonb blob per
 * row, and `profiles.current_course_id` is a reference to it — so two trainees
 * sharing a row shared a programme, and editing it for one of them silently
 * rewrote the other's. Nothing in the panel said so: the library card counted
 * the trainees on a course but the builder opened it as a single document.
 */

const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * `base`, or `base 2`, `base 3`… — whichever nobody is using.
 *
 * Names are not unique in the database and do not need to be. They are how the
 * coach finds a course in a list of them, though, and three rows called
 * "برنامج التنشيف (نسخة)" are three rows nobody can tell apart.
 */
async function uniqueCourseName(base: string): Promise<string> {
  const taken = new Set(
    (
      await prisma.courses.findMany({
        where: { name: { startsWith: base } },
        select: { name: true },
      })
    ).map((course) => course.name)
  );

  if (!taken.has(base)) return base;
  for (let n = 2; n < 500; n++) {
    if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
  }
  return `${base} ${Date.now()}`;
}

/** What to call a trainee in a course name — their real name if the intake carries one. */
function displayName(profile: { username: string; data: unknown }): string {
  const raw = profile.data;
  const blob =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : ((raw as Record<string, unknown>) ?? {});
  const fullname = typeof blob.fullname === "string" ? blob.fullname.trim() : "";
  return fullname || profile.username;
}

/**
 * Copies a course into the library, unassigned.
 *
 * The copy carries the days across and nothing else: not the trainees on the
 * original, not its training cycles, not its logs. It is a new programme that
 * happens to start life identical to another one.
 */
export async function duplicateCourseAction(courseId: string) {
  const session = await requireAdminAction();
  if (!session) return DENIED;

  if (!isValidUUID(courseId)) return { success: false, error: "معرّف الكورس غير صالح" };

  try {
    const source = await prisma.courses.findUnique({
      where: { id: courseId },
      select: { name: true, description: true, days_data: true },
    });
    if (!source) return { success: false, error: "الكورس غير موجود" };

    const copy = await prisma.courses.create({
      data: {
        name: await uniqueCourseName(`${source.name} (نسخة)`),
        description: source.description,
        /* Read through the same narrowing the rest of the panel uses, so a
           legacy row's shape is normalised on the way into the copy rather
           than carried forward for another year. */
        days_data: asDays(source.days_data),
        coach_id: session.userId,
      },
    });

    revalidatePath("/admin/courses");
    revalidatePath("/admin/builder");

    return { success: true, courseId: copy.id, name: copy.name };
  } catch (error) {
    return { success: false, error: errorMessage(error, "حدث خطأ أثناء نسخ الكورس") };
  }
}

/**
 * The contents of one course, for the builder to start a new one from.
 *
 * Only the parts a new course is built out of come back — no id, so nothing the
 * caller does with this can be saved over the original.
 */
export async function loadCourseTemplateAction(courseId: string) {
  const session = await requireAdminAction();
  if (!session) return { success: false as const, error: "غير مصرح لك بهذا الإجراء" };

  if (!isValidUUID(courseId)) {
    return { success: false as const, error: "معرّف الكورس غير صالح" };
  }

  try {
    const course = await prisma.courses.findUnique({
      where: { id: courseId },
      select: { name: true, description: true, days_data: true },
    });
    if (!course) return { success: false as const, error: "الكورس غير موجود" };

    return {
      success: true as const,
      course: {
        name: course.name,
        description: course.description ?? "",
        days: asDays(course.days_data),
      },
    };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, "تعذّر تحميل الكورس") };
  }
}

export async function saveCourseAction(data: {
  courseId?: string; // If editing
  name: string;
  description?: string;
  traineeId?: string;
  daysData: Day[];
}) {
  const session = await requireAdminAction();
  if (!session) return DENIED;

  try {
    if (!data.name) {
      return { success: false, error: "اسم الكورس مطلوب" };
    }

    /* The coach is whoever is signed in, taken from the session. It used to
       arrive in `data.coachId`, read from the browser's localStorage — an
       arbitrary string that had to be shape-checked and then looked up just to
       find out whether it named anybody. The session already answers that, and
       cannot be edited by the caller. */
    const validCoachId = session.userId;

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
        prisma.training_cycles.updateMany({
          where: { profile_id: data.traineeId, completed_at: null },
          data: { completed_at: new Date() },
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
  const session = await requireAdminAction();
  if (!session) return DENIED;

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

/**
 * Gives a trainee their own copy of a library course.
 *
 * It used to point `profiles.current_course_id` straight at the course it was
 * handed. That is what made the library dangerous to reuse: assign one course
 * to two people and they shared a single `days_data` blob, so tailoring it for
 * one rewrote the other's programme, with nothing on either screen to say the
 * document was shared. The library holds templates now, and this takes one.
 *
 * The copy is named after the trainee, because a library of six rows called
 * "برنامج التنشيف" is a library the coach has to open one by one.
 */
export async function assignCourseAction(courseId: string, traineeId: string) {
  const session = await requireAdminAction();
  if (!session) return DENIED;

  if (!isValidUUID(courseId) || !isValidUUID(traineeId)) {
    return { success: false, error: "طلب غير صالح" };
  }

  try {
    const [source, trainee] = await Promise.all([
      prisma.courses.findUnique({
        where: { id: courseId },
        select: { name: true, description: true, days_data: true },
      }),
      prisma.profiles.findUnique({
        where: { id: traineeId },
        select: { username: true, data: true, current_course_id: true },
      }),
    ]);

    if (!source) return { success: false, error: "الكورس غير موجود" };
    if (!trainee) return { success: false, error: "المشترك غير موجود" };

    /* Already on this exact course. Copying would hand them a second identical
       programme and end their current training cycle to do it. */
    if (trainee.current_course_id === courseId) {
      return { success: true, courseId };
    }

    const name = await uniqueCourseName(`${source.name} — ${displayName(trainee)}`);

    /* One transaction, and the copy is created inside it. Created before it, a
       failure in the assignment would leave a course in the library that
       belongs to nobody and that the coach never asked for. */
    const copy = await prisma.$transaction(async (tx) => {
      const created = await tx.courses.create({
        data: {
          name,
          description: source.description,
          days_data: asDays(source.days_data),
          coach_id: session.userId,
        },
      });

      await tx.client_courses.updateMany({
        where: { client_id: traineeId, is_active: true },
        data: { is_active: false },
      });
      await tx.profiles.update({
        where: { id: traineeId },
        data: { current_course_id: created.id },
      });
      await tx.client_courses.create({
        data: { client_id: traineeId, course_id: created.id, is_active: true },
      });
      await tx.training_cycles.updateMany({
        where: { profile_id: traineeId, completed_at: null },
        data: { completed_at: new Date() },
      });

      return created;
    });

    revalidatePath("/admin/courses");
    revalidatePath("/admin/builder");

    return { success: true, courseId: copy.id, name: copy.name };
  } catch (error) {
    console.error("Failed to assign course:", error);
    return { success: false, error: errorMessage(error, "حدث خطأ أثناء تعيين الكورس") };
  }
}
