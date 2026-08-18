import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword, hashPassword } from "@/lib/auth";
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

    let isMatch = false;
    /* Only compare as plaintext if the stored value is not a bcrypt hash at all,
       so a stolen hash cannot be replayed as the password itself.
     *
     * `$2y$` belongs in this list. It is what PHP's crypt writes and what plenty
     * of import tools emit, it is the same algorithm as `$2b$`, and bcrypt
     * verifies it — but it was missing here, so such a row fell through to the
     * comparison below and was tested against the literal string "$2y$...". That
     * never matches, which made it a lockout rather than a hole; it is a bug
     * either way. */
    const isBcrypt = /^\$2[aby]\$/.test(account.password);

    if (isBcrypt) {
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
    } else {
      isMatch = (password === account.password);
    }

    if (!isMatch) {
      return NextResponse.json({ error: REFUSED }, { status: 401 });
    }

    /* A correct password against a row that was never hashed: hash it now.
     *
     * Every write path — registration, the coach's reset, the trainee's own
     * change — has produced bcrypt for some time, so the plaintext rows are a
     * finite set left over from before that. Nothing was draining it, which
     * meant the branch above had to stay forever and every one of those rows
     * stayed readable to anyone who reached the table. Upgrading on the one
     * occasion the plaintext is legitimately in hand empties the set as its
     * owners sign in, and makes deleting that branch a decision about a number
     * that is going down rather than an open question.
     *
     * Failure here is not the trainee's problem: they gave the right password.
     * Log it and let them in — the next sign-in tries again. */
    if (!isBcrypt) {
      try {
        await prisma.accounts.update({
          where: { id: account.id },
          data: { password: await hashPassword(password) },
        });
      } catch (error) {
        console.error(`Failed to upgrade legacy password for account ${account.id}:`, error);
      }
    }

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
