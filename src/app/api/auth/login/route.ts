import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword, equalizePasswordTiming, isBcryptHash } from "@/lib/auth";
import { startSession } from "@/lib/authGuard";
import { clearAttempts, clientAddress, consumeAttempt } from "@/lib/rateLimit";

/* One refusal for "no such username" and for "wrong password".
 *
 * They used to differ, which turned this endpoint into a way to ask whether an
 * account exists: submit a username with any password and read which sentence
 * comes back. That is the first half of an attack — build the list of real
 * usernames, then spend the guesses only on those.
 *
 * The trainee who mistypes their username sees the same sentence as the one who
 * mistypes their password, which is the cost, and it is small: both are fixed
 * by trying again. */
const REFUSED = "اسم المستخدم أو كلمة المرور غير صحيحة";

export async function POST(request: Request) {
  try {
    const { username, password, remember } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "اسم المستخدم وكلمة المرور مطلوبان" },
        { status: 400 }
      );
    }

    /* Two counters, both consumed before the password is looked at.
     *
     * By address, so one machine cannot work through a word list; and by
     * submitted username, so spreading the same attack over many addresses
     * still runs into a ceiling on the account being attacked. Neither alone is
     * enough — the first is evaded with a proxy pool, the second by attacking
     * many accounts at once.
     *
     * The username is lowercased into the key so `Admin` and `admin` cannot be
     * counted as two separate accounts to guess against. */
    /* Trimmed once, and used both as the counter key and as the name looked up
       below. The raw value used to serve both, and a trailing space — which no
       stored username can carry, `USERNAME_PATTERN` forbids the space — was a
       name that could never match: every attempt failed whatever the password
       was, under a counter key of its own that a later success never cleared. */
    const address = clientAddress(request);
    const cleanUsername = String(username).trim();
    const userKey = `user:${cleanUsername.toLowerCase().slice(0, 64)}`;
    const ipKey = `ip:${address}`;

    const [byAddress, byUser] = await Promise.all([
      consumeAttempt(ipKey),
      consumeAttempt(userKey),
    ]);

    if (!byAddress.allowed || !byUser.allowed) {
      const retryAfter = Math.max(byAddress.retryAfterSeconds, byUser.retryAfterSeconds);
      return NextResponse.json(
        { error: "محاولات كثيرة جداً — انتظر قليلاً ثم أعد المحاولة" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    /* From here to the password verdict, both a real account and an absent one
       do the same work in the same order — one profile lookup and one bcrypt
       comparison — so that the response time answers nothing that the unified
       message withholds. See `equalizePasswordTiming` and TIMING_EQUALIZER_HASH
       in `@/lib/auth` for the measurement that made this necessary. The verdict
       is only formed at the end, once the work is done. */
    const account = await prisma.accounts.findUnique({
      where: { username: cleanUsername },
    });

    /* Always one profile lookup, whether or not the account exists — the absent
       case queries a user id that cannot match rather than skipping the query,
       so the round trip count does not depend on the answer.

       Newest first, matching /api/profile: that is the profile the dashboard
       will load, so it is the one whose suspension has to be honoured here. */
    const NIL_UUID = "00000000-0000-0000-0000-000000000000";
    const profile = await prisma.profiles.findFirst({
      where: { user_id: account?.id ?? NIL_UUID },
      orderBy: { created_at: "desc" },
    });

    /* Always one bcrypt comparison. Against the stored hash when there is a
       usable one, and against the equalizer hash otherwise — an absent account,
       or the anomaly of a stored value that is not a bcrypt hash. `passwordOk`
       is only trusted below, and only when the account is real and hashed. */
    const usableHash = account && isBcryptHash(account.password);
    let passwordOk = false;
    try {
      passwordOk = usableHash
        ? await comparePassword(password, account.password)
        : await equalizePasswordTiming(password);
    } catch (error) {
      console.error(
        `bcrypt comparison failed${account ? ` for account ${account.id}` : ""}:`,
        error
      );
      return NextResponse.json(
        { error: "حدث خطأ أثناء تسجيل الدخول" },
        { status: 500 }
      );
    }

    /* The verdicts, formed only now.
     *
     * An absent account and a wrong password are the same refusal, in the same
     * time. A suspended account is told so on purpose — a person who cannot sign
     * in needs to know why, and that this reveals the account exists is a
     * deliberate, long-standing choice, not a leak this is trying to close. */
    if (!account) {
      return NextResponse.json({ error: REFUSED }, { status: 401 });
    }

    /* Read the suspension flag from its column. It used to be looked up inside
       the JSON blob, where a renamed or misspelled key would have silently let
       a suspended account straight through. */
    if (profile?.is_suspended) {
      return NextResponse.json(
        { error: "الحساب متوقف يرجى التواصل مع الادارة" },
        { status: 403 }
      );
    }

    /* A stored value that is not a bcrypt hash is no longer compared as a
     * password. It used to be, as a string equality — the last route by which a
     * password held in plaintext was an accepted credential. That branch drained
     * itself and every write path produces bcrypt now; what is left is a
     * refusal, logged distinctly because a refusal nobody can explain is worse
     * than the bug. If this line appears, that account needs a reset with
     * `scripts/reset-password.mjs` — it is not a wrong password, and the person
     * typing it cannot tell. The equalizer comparison above already spent
     * bcrypt's time, so this refusal is not a faster answer than any other. */
    if (!usableHash) {
      console.error(
        `[login] account ${account.id} has a password that is not a bcrypt hash; ` +
          `refusing rather than comparing it as text. Reset it with scripts/reset-password.mjs.`
      );
      return NextResponse.json({ error: REFUSED }, { status: 401 });
    }

    if (!passwordOk) {
      return NextResponse.json({ error: REFUSED }, { status: 401 });
    }

    /* The rehash-on-sign-in that used to sit here is gone with the branch it
       served. It could only ever fire for a password that had just been
       compared as text, and nothing is compared as text any more. */

    /* Signed in — so the attempts that led here were not an attack. Clearing
       them means a trainee who mistyped twice this morning is not a few keys
       away from a lockout this afternoon. */
    await clearAttempts([ipKey, userKey]);

    /* Issue the session cookie. Without this the password check above was the
       end of the story: the browser kept the identity in localStorage, which
       `proxy.ts` runs too early — and on the wrong machine — to ever see. Every
       guarded path therefore found no session and bounced the visitor straight
       back to /login, so a correct password looked like a failed one.
       `endSession` was already wired into /api/auth/logout; this is the other
       half that was never connected. */
    const session = await startSession(account, remember === true);

    return NextResponse.json({
      success: true,
      userId: account.id,
      username: account.username,
      isAdmin: session.isAdmin,
    });
  } catch (error: unknown) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 }
    );
  }
}
