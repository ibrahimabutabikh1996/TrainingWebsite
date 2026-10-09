import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authGuard";
import type { JsonRecord } from "@/types";

/* Clears the "new subscriber" flag the panel's list draws. Only the coach sees
   that list, so only the coach can have read it. */
export async function POST(request: Request) {
  const auth = await requireAdmin("subscribers.view");
  if (!auth.ok) return auth.response;

  try {
    const { id, notificationId } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: "معرّف الملف مفقود" }, { status: 400 });
    }

    const profile = await prisma.profiles.findUnique({
      where: { id }
    });

    if (!profile) {
      return NextResponse.json({ error: "لم يتم العثور على الملف" }, { status: 404 });
    }

    /* `|| {}` and a guarded parse, matching the other routes that read this
       column. Neither was here: a null `data` threw on the next line, and a
       string that is not valid JSON threw inside `JSON.parse` — both surfacing
       as a 500 for the act of marking a subscriber as read. */
    let data = (profile.data as JsonRecord) || {};
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { data = {}; }
    }


    /* One entry in the bell, stamped rather than removed: read entries stay in
       the list under the "read" filter. */
    const notices: JsonRecord[] = Array.isArray(data.notifications) ? data.notifications : [];
    const notice = notificationId ? notices.find((n) => n && n.id === notificationId) : undefined;
    let marked = false;
    if (notice && !notice.read_at) {
      notice.read_at = new Date().toISOString();
      marked = true;
    }
    /* A trainee from before the list existed: the panel shows their unread
       `is_new` as `legacy-<id>`. Written down as a real, read entry, or it
       would vanish from the bell instead of moving to "read". */
    if (!notice && notificationId === `legacy-${id}` && !Array.isArray(data.notifications)) {
      data.notifications = [{
        id: notificationId,
        type: data.is_renewal ? "renewal" : "new",
        at: new Date(profile.created_at).toISOString(),
        read_at: new Date().toISOString(),
      }];
      marked = true;
    }

    if (data.is_new || marked) {
      data.is_new = false;
      await prisma.profiles.update({
        where: { id },
        data: {
          data
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
