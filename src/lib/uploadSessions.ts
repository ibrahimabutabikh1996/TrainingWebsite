import "server-only";
import { prisma } from "@/lib/db";
import { supabaseAdmin, UPLOADS_BUCKET } from "@/lib/supabaseAdmin";
import { detectFileType, INTAKE_RULE, type DetectedType } from "@/lib/uploads";
import { probeImage } from "@/lib/imageProbe";
import type { Session } from "@/lib/session";

/* The authority behind a direct-to-storage upload.
 *
 * The browser now sends its bytes to Supabase rather than through the app, which
 * is the only way past Vercel's ~4.5 MB request body limit. That moves the
 * question of "may this file exist, here, for this person" out of the request
 * that carries the bytes — so it lives here instead, in a session the server
 * issues and a row per object it names itself.
 *
 *     created ── client uploads ──▶ uploaded ── verified ──▶ confirmed ──▶ attached
 *                                                  │
 *                                                  └── failed ──▶ deleted (rejected)
 *
 * The client supplies exactly two things, ever: a session id and an item id,
 * both minted here. It never names a path, a bucket, a profile or a field it was
 * not granted; every one of those is looked up from these rows.
 */

/** How long a browser has to finish its uploads. */
const SESSION_TTL_MINUTES = 60;

/** Across every field. A registration uses a handful; this is the ceiling. */
const MAX_ITEMS_PER_SESSION = 30;

/** Read from the stored object to identify it — a header, not the whole file. */
const PROBE_BYTES = 64 * 1024;

/* Shared with the browser, which has to name a field to ask for a slot. */
import { INTAKE_UPLOAD_FIELDS, isIntakeUploadField } from "@/lib/uploadFields";
export { INTAKE_UPLOAD_FIELDS, isIntakeUploadField };

export type UploadScope = "registration" | "renewal" | "cms";

/** Where each scope is allowed to write. Nothing may cross between them. */
const SCOPE_PREFIX: Record<UploadScope, string> = {
  registration: "usersData",
  renewal: "usersData",
  /* Public, admin-write only. A user-facing endpoint never issues this scope. */
  cms: "images",
};

/**
 * Content types a stored object may carry.
 *
 * The browser declares this when it uploads, so it is the caller's to choose —
 * which is why it is checked rather than trusted. It has to match what the bytes
 * turned out to be, or be a neutral type that renders as nothing. Anything else
 * (`text/html` above all) is refused: while the bucket is public, a stored
 * object is a URL anyone can open, and its declared type decides what the
 * browser does with it.
 */
const NEUTRAL_CONTENT_TYPES = new Set(["application/octet-stream", "binary/octet-stream", ""]);

export interface UploadSessionRow {
  id: string;
  scope: string;
  account_id: string | null;
  profile_id: string | null;
  status: string;
  expires_at: Date;
}

export type SessionResult =
  | { ok: true; session: UploadSessionRow }
  | { ok: false; status: 400 | 403 | 404 | 409 | 410; error: string };

/* ------------------------------------------------------------------ *
 * Opening a session
 * ------------------------------------------------------------------ */

export async function createUploadSession(input: {
  scope: UploadScope;
  accountId?: string | null;
  profileId?: string | null;
  clientIp: string;
}): Promise<UploadSessionRow> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

  return prisma.upload_sessions.create({
    data: {
      scope: input.scope,
      account_id: input.accountId ?? null,
      profile_id: input.profileId ?? null,
      expires_at: expiresAt,
      client_ip: input.clientIp.slice(0, 64),
    },
    select: { id: true, scope: true, account_id: true, profile_id: true, status: true, expires_at: true },
  });
}

/**
 * Loads a session and decides whether this caller may use it.
 *
 * A registration session belongs to nobody — there is no account yet — so the id
 * is all there is to go on. That is deliberately not treated as authorisation on
 * its own: the session expires within the hour, is single-use, caps how many
 * files it can hold, and creating one is rate limited per address. What it grants
 * is a scratch folder that reaches no existing profile and no existing account,
 * which is the most an anonymous visitor could be given.
 *
 * A renewal session names an account, and the caller has to be it.
 */
export async function openSession(
  sessionId: string,
  viewer: Session | null
): Promise<SessionResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return { ok: false, status: 400, error: "معرّف الرفع غير صالح" };
  }

  const session = await prisma.upload_sessions.findUnique({
    where: { id: sessionId },
    select: { id: true, scope: true, account_id: true, profile_id: true, status: true, expires_at: true },
  });

  if (!session) return { ok: false, status: 404, error: "جلسة الرفع غير موجودة" };

  if (session.status === "consumed") {
    return { ok: false, status: 409, error: "جلسة الرفع استُخدمت بالفعل" };
  }
  if (session.expires_at.getTime() <= Date.now()) {
    return { ok: false, status: 410, error: "انتهت صلاحية جلسة الرفع، يرجى إعادة اختيار الملفات" };
  }

  /* Owned sessions require the owner — the owner, and nobody else. Registration
     sessions have no owner to check against, by construction, and are unchanged
     by this: `account_id` is null there, so this block does not run.
     *
     * The coach used to pass too, on `viewer.isAdmin`. Two things were wrong with
     * that. The smaller one is that `viewer` reaches here from a bare
     * `getSession()` — no `sessionRefusal` — so the exemption was granted on a
     * token that may already have been withdrawn, which is the one credential
     * that should not still work.
     *
     * The larger one is that nothing needed the exemption. Every upload session
     * is created with `accountId: viewer.userId` (see /api/uploads/session), so
     * the person entitled to a session is always its creator and always passes
     * the ownership test on its own — including the coach opening one for a
     * trainee, because that session is recorded against the coach. The panel
     * never calls these endpoints at all: content-manager uploads go through
     * /api/admin/media and `storeCmsMedia`, which does not mint a session. The
     * branch could therefore only ever fire for a coach acting on a session
     * belonging to somebody else, which no screen does.
     *
     * So it is removed rather than guarded. What remains is a test of identity —
     * "is this your session" — and a withdrawn token does not turn its holder
     * into a different person, so there is nothing left here for revocation to
     * decide and no query to pay for. If acting on another account's session
     * ever becomes a real feature, it should arrive with its own guard and a
     * session that has been checked, not inherit a blanket exemption. */
  if (session.account_id) {
    if (!viewer || viewer.userId !== session.account_id) {
      return { ok: false, status: 403, error: "غير مصرح لك بهذا الإجراء" };
    }
  }

  return { ok: true, session };
}

/* ------------------------------------------------------------------ *
 * Issuing a slot
 * ------------------------------------------------------------------ */

export type SlotResult =
  | { ok: true; itemId: string; path: string; token: string; maxBytes: number }
  | { ok: false; status: 400 | 403 | 429 | 500; error: string };

function randomSegment(): string {
  return `${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Names a path, records it, and hands back a token that can write to that path
 * and nowhere else.
 *
 * The path carries no extension on purpose. It is chosen before anyone knows
 * what the bytes are, and an extension chosen then could only come from the
 * submitted filename — which is exactly the thing not to trust. What the object
 * is gets recorded in the row at confirmation, and the reader serves it from
 * there.
 */
export async function issueSlot(
  session: UploadSessionRow,
  field: string
): Promise<SlotResult> {
  const scope = session.scope as UploadScope;

  if (scope === "cms") {
    /* Reached only through the admin path, which does not call this. */
    return { ok: false, status: 403, error: "غير مصرح لك بهذا الإجراء" };
  }
  if (!(INTAKE_UPLOAD_FIELDS as readonly string[]).includes(field)) {
    return { ok: false, status: 400, error: "حقل الرفع غير معروف" };
  }

  const [totalItems, fieldItems] = await Promise.all([
    prisma.upload_items.count({
      where: { session_id: session.id, status: { not: "rejected" } },
    }),
    prisma.upload_items.count({
      where: { session_id: session.id, field, status: { not: "rejected" } },
    }),
  ]);

  if (totalItems >= MAX_ITEMS_PER_SESSION) {
    return { ok: false, status: 429, error: "تم بلوغ الحد الأقصى لعدد الملفات" };
  }
  if (fieldItems >= INTAKE_RULE.maxFiles) {
    return {
      ok: false,
      status: 429,
      error: `عدد الملفات في هذا الحقل يتجاوز الحد المسموح (${INTAKE_RULE.maxFiles})`,
    };
  }

  /* Scoped to the session, so one session's folder can never be another's, and
     the folder name is not derived from anything the client sent. */
  const path = `${SCOPE_PREFIX[scope]}/${session.id}/${field}_${randomSegment()}`;

  const { data, error } = await supabaseAdmin.storage
    .from(UPLOADS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("Failed to create a signed upload URL:", error);
    return { ok: false, status: 500, error: "تعذّر تجهيز الرفع" };
  }

  const item = await prisma.upload_items.create({
    data: { session_id: session.id, field, storage_path: path },
    select: { id: true },
  });

  return {
    ok: true,
    itemId: item.id,
    path,
    token: data.token,
    maxBytes: INTAKE_RULE.maxBytes,
  };
}

/* ------------------------------------------------------------------ *
 * Confirming
 * ------------------------------------------------------------------ */

export type ConfirmResult =
  | { ok: true; itemId: string; field: string; type: DetectedType; sizeBytes: number }
  | { ok: false; status: 400 | 403 | 404 | 413; error: string };

/** Removes an object and marks the slot rejected. Both, and in that order. */
async function rejectItem(itemId: string, path: string, reason: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(UPLOADS_BUCKET).remove([path]);
  if (error) {
    /* The row is still marked rejected, so the sweep will try again. A file left
       behind is a cost, not a correctness problem. */
    console.error(`Failed to delete a rejected upload (${path}):`, error);
  }
  await prisma.upload_items.update({
    where: { id: itemId },
    data: { status: "rejected" },
  });
  console.warn(`Rejected upload ${itemId}: ${reason}`);
}

/**
 * Reads the object back out of storage and decides whether it may be kept.
 *
 * Everything checked here is checked against the object itself — its real size,
 * its real leading bytes, the content type it was actually stored with. Nothing
 * the client said about the file is consulted, because by this point the client
 * has already had its chance to lie.
 */
export async function confirmItem(
  session: UploadSessionRow,
  itemId: string
): Promise<ConfirmResult> {
  const item = await prisma.upload_items.findUnique({
    where: { id: itemId },
    select: { id: true, session_id: true, field: true, storage_path: true, status: true },
  });

  /* The item has to belong to the session the caller opened — which the caller
     had to be authorised for. An id from somewhere else is "not found", so the
     endpoint cannot be used to discover which ids exist. */
  if (!item || item.session_id !== session.id) {
    return { ok: false, status: 404, error: "الملف غير موجود" };
  }
  if (item.status === "attached" || item.status === "rejected") {
    return { ok: false, status: 409 as 400, error: "تم البتّ في هذا الملف بالفعل" };
  }

  const { data: blob, error } = await supabaseAdmin.storage
    .from(UPLOADS_BUCKET)
    .download(item.storage_path);

  if (error || !blob) {
    return { ok: false, status: 404, error: "لم يُعثر على الملف المرفوع" };
  }

  const sizeBytes = blob.size;
  if (sizeBytes === 0) {
    await rejectItem(item.id, item.storage_path, "empty object");
    return { ok: false, status: 400, error: "الملف فارغ" };
  }
  if (sizeBytes > INTAKE_RULE.maxBytes) {
    /* The real size, from the object. The browser's claim is irrelevant. */
    await rejectItem(item.id, item.storage_path, `oversized (${sizeBytes} bytes)`);
    return { ok: false, status: 413, error: "حجم الملف يتجاوز الحد المسموح" };
  }

  const head = new Uint8Array(await blob.slice(0, PROBE_BYTES).arrayBuffer());
  const detected = detectFileType(head.subarray(0, 32));

  if (!detected) {
    await rejectItem(item.id, item.storage_path, "unrecognised magic bytes");
    return { ok: false, status: 400, error: "نوع الملف غير معروف أو غير مدعوم" };
  }
  if (!INTAKE_RULE.allowed.includes(detected.type)) {
    await rejectItem(item.id, item.storage_path, `disallowed type ${detected.type}`);
    return { ok: false, status: 400, error: "نوع الملف غير مسموح به" };
  }

  /* The type the object is *served* as, which is what a browser opening its URL
     will act on. It has to agree with the bytes, or be something inert. */
  const storedType = (blob.type || "").toLowerCase().split(";")[0].trim();
  if (storedType !== detected.mime && !NEUTRAL_CONTENT_TYPES.has(storedType)) {
    await rejectItem(
      item.id,
      item.storage_path,
      `content-type "${storedType}" disagrees with detected ${detected.mime}`
    );
    return { ok: false, status: 400, error: "نوع المحتوى لا يطابق محتوى الملف" };
  }

  /* Magic bytes say the first few bytes look right; this says there is a real
     picture behind them. Formats it cannot parse come back `unknown` and stand
     on the signature alone. */
  const probe = probeImage(detected.type, head);
  if (probe.kind === "invalid") {
    await rejectItem(item.id, item.storage_path, `structure check failed: ${probe.reason}`);
    return { ok: false, status: 400, error: "الملف ليس صورة صالحة" };
  }

  await prisma.upload_items.update({
    where: { id: item.id },
    data: {
      status: "confirmed",
      detected_type: detected.type,
      mime: detected.mime,
      size_bytes: BigInt(sizeBytes),
      confirmed_at: new Date(),
    },
  });

  return { ok: true, itemId: item.id, field: item.field, type: detected.type, sizeBytes };
}

/* ------------------------------------------------------------------ *
 * Attaching
 * ------------------------------------------------------------------ */

/**
 * The confirmed objects in a session, grouped by field. Reads only.
 *
 * Only `confirmed` rows are included: an object that was uploaded but failed
 * verification, or was never confirmed at all, is not part of the submission and
 * will be swept.
 */
export async function confirmedPathsFor(
  sessionId: string,
  keepItemIds?: string[]
): Promise<Record<string, string[]>> {
  /* `keepItemIds` lets the form drop a file the person removed before
     submitting. It can only ever narrow: the set is intersected with the rows
     this session actually confirmed, so naming somebody else's id — or one that
     was rejected — adds nothing. */
  const items = await prisma.upload_items.findMany({
    where: {
      session_id: sessionId,
      status: "confirmed",
      ...(keepItemIds ? { id: { in: keepItemIds } } : {}),
    },
    orderBy: { created_at: "asc" },
    select: { field: true, storage_path: true },
  });

  const grouped: Record<string, string[]> = {};
  for (const item of items) {
    (grouped[item.field] ??= []).push(item.storage_path);
  }
  return grouped;
}

/** The subset of the Prisma client an interactive transaction hands back. */
type PrismaTx = Omit<typeof prisma, "$transaction" | "$connect" | "$disconnect" | "$on" | "$extends">;

/**
 * Marks every confirmed object as attached and closes the session.
 *
 * Takes a transaction client and is meant to run in the same transaction as the
 * profile write, because the two have to agree. Attaching without the profile
 * leaves files nothing points at; writing the profile without attaching leaves
 * files the sweep believes are abandoned — and it would eventually delete
 * pictures a trainee's record is displaying. One transaction, both or neither.
 *
 * Closing the session is what makes it single-use: a submitted registration
 * cannot go back and add files to the profile it just created.
 */
export async function attachSessionItems(
  tx: PrismaTx,
  sessionId: string,
  profileId: string,
  keepItemIds?: string[]
): Promise<void> {
  const now = new Date();

  /* Exactly the rows whose paths went into the profile — the same filter
     `confirmedPathsFor` used. Attaching more would keep files nothing displays;
     attaching fewer would let the sweep delete a file the record shows. */
  await tx.upload_items.updateMany({
    where: {
      session_id: sessionId,
      status: "confirmed",
      ...(keepItemIds ? { id: { in: keepItemIds } } : {}),
    },
    data: { status: "attached", attached_at: now },
  });

  await tx.upload_sessions.update({
    where: { id: sessionId },
    data: { status: "consumed", consumed_at: now, profile_id: profileId },
  });
}

