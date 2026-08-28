import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword, isBcryptHash } from "@/lib/auth";
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
    const address = clientAddress(request);
    const userKey = `user:${String(username).toLowerCase().slice(0, 64)}`;
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

    const account = await prisma.accounts.findUnique({
      where: { username },
    });

    if (!account) {
      return NextResponse.json({ error: REFUSED }, { status: 401 });
    }

    /* Newest first, matching /api/profile: that is the profile the dashboard will
       load, so it is the one whose suspension has to be honoured here. */
    const profile = await prisma.profiles.findFirst({
      where: { user_id: account.id },
      orderBy: { created_at: "desc" },
    });

    /* Read the suspension flag from its column. It used to be looked up inside
       the JSON blob, where a renamed or misspelled key would have silently let
       a suspended account straight through. */
    if (profile?.is_suspended) {
      return NextResponse.json(
        { error: "الحساب متوقف يرجى التواصل مع الادارة" },
        { status: 403 }
      );
    }

    /* A stored value that is not a bcrypt hash is no longer compared.
     *
     * It used to be, as a string equality — the last route by which a password
     * held in plaintext was an accepted credential. The branch was written to
     * carry a finite set of rows left over from before hashing, and it drained
     * itself: a correct plaintext password was rehashed on the way through, so
     * the set only ever shrank. Every write path — registration, the coach's
     * reset, a trainee changing their own — has produced bcrypt throughout.
     *
     * What replaces it is a refusal, not a comparison. That is the safe
     * direction to fail in: the worst case is an account that cannot sign in
     * and must be reset with `scripts/reset-password.mjs`, against a worst case
     * of a password sitting readable in a column that a leaked connection
     * string, a restored backup or the query log this app used to keep would
     * each have handed over.
     *
     * Logged loudly and distinctly, because a refusal nobody can explain is
     * worse than the bug. If this line ever appears, that account needs a reset
     * — it is not a wrong password, and the person typing it cannot tell. */
    if (!isBcryptHash(account.password)) {
      console.error(
        `[login] account ${account.id} has a password that is not a bcrypt hash; ` +
          `refusing rather than comparing it as text. Reset it with scripts/reset-password.mjs.`
      );
      return NextResponse.json({ error: REFUSED }, { status: 401 });
    }

    let isMatch = false;
    /* Matches the handling in /api/auth/change-password: a bcrypt fault must not
       be reported as a wrong password, or the two screens would both reject a
       correct password with no trace of the real cause. */
    try {
      isMatch = await comparePassword(password, account.password);
    } catch (error) {
      console.error(`bcrypt comparison failed for account ${account.id}:`, error);
      return NextResponse.json(
        { error: "حدث خطأ أثناء تسجيل الدخول" },
        { status: 500 }
      );
    }

    if (!isMatch) {
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
