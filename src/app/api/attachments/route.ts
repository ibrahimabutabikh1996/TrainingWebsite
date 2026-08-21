import { NextResponse, type NextRequest } from "next/server";
import { requireUser, sessionOwnsProfile } from "@/lib/authGuard";
import { isPrivatePath, isStoragePath, PUBLIC_PREFIX } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import { supabaseAdmin, PUBLIC_MEDIA_BUCKET, UPLOADS_BUCKET } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Long enough to load a page of photos, short enough that a leaked link dies. */
const SIGNED_URL_SECONDS = 300;

/**
 * GET /api/attachments?path=… — the authorising reader for stored files.
 *
 * This is what makes the bucket's eventual privacy a configuration change rather
 * than a rewrite: every render site already asks here, and here the question
 * "may you see this" is answered before a signed URL exists.
 *
 * Two checks, and both are needed:
 *
 *   1. the caller owns the profile, or is the coach;
 *   2. the profile they own actually references this exact path.
 *
 * The second is the one that matters. Without it, any signed-in trainee could
 * name any path in the bucket and be handed a signed URL for it — ownership of
 * *a* profile is not ownership of *this* file.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");

  if (!path || !isStoragePath(path)) {
    return NextResponse.json({ error: "المسار غير صالح" }, { status: 400 });
  }

  /* Page imagery is public content — it is what an anonymous visitor sees on the
     landing page — so it needs no session. It is still checked against the
     prefix, so this route cannot be used to reach a trainee's folder. */
  if (path.startsWith(PUBLIC_PREFIX)) {
    return redirectToSigned(path);
  }

  if (!isPrivatePath(path)) {
    return NextResponse.json({ error: "المسار غير صالح" }, { status: 400 });
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  if (auth.session.isAdmin) {
    return redirectToSigned(path);
  }

  /* Which profile is this file filed under? Read from the upload record the
     server itself wrote, not from the address bar. */
  const item = await prisma.upload_items.findUnique({
    where: { storage_path: path },
    select: { status: true, upload_sessions: { select: { profile_id: true } } },
  });

  if (item?.status === "attached" && item.upload_sessions.profile_id) {
    if (await sessionOwnsProfile(auth.session, item.upload_sessions.profile_id)) {
      return redirectToSigned(path);
    }
    return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 });
  }

  /* Files uploaded before this lifecycle existed have no `upload_items` row.
     They are still referenced from the profile's own answers, so that is what is
     consulted — the same rule, applied to the older shape. */
  if (await profileReferencesPath(auth.session.userId, path)) {
    return redirectToSigned(path);
  }

  return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 });
}

/**
 * Whether the signed-in account's own profile mentions this path anywhere in its
 * answers — current month or an archived one.
 *
 * Matches on the path *and* on the legacy public URL that ends with it, because
 * rows written before normalisation still hold the full address.
 */
async function profileReferencesPath(accountId: string, path: string): Promise<boolean> {
  const profile = await prisma.profiles.findFirst({
    where: { user_id: accountId },
    orderBy: { created_at: "desc" },
    select: { data: true },
  });
  if (!profile) return false;

  const blob = typeof profile.data === "string" ? profile.data : JSON.stringify(profile.data ?? {});

  /* A containment test over the serialised answers. Coarse, but it can only ever
     grant access to a path the trainee's own record already names, and the path
     segment is random enough that a partial match is not a practical concern. */
  return blob.includes(path);
}

async function redirectToSigned(path: string): Promise<NextResponse> {
  /* Which bucket the path lives in follows its prefix, because the two kinds of
     file now live apart: `usersData/` in the private bucket this route exists to
     guard, `images/` in the public one the landing page reads directly. Page
     imagery does not normally arrive here at all — it is rendered from its own
     public address — but the prefix is still accepted, and it has to be signed
     against the bucket that actually holds it. */
  const bucket = isPrivatePath(path) ? UPLOADS_BUCKET : PUBLIC_MEDIA_BUCKET;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error(`Failed to sign ${path}:`, error);
    return NextResponse.json({ error: "تعذّر فتح الملف" }, { status: 404 });
  }

  /* 307 so the browser fetches the object itself; the signed URL never lands in
     the page source, and it stops working within minutes either way. */
  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
