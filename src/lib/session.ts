/* The session token: who is signed in, proved by a signature rather than by a
   row in a table.
 *
 * Sign-in state used to live in `localStorage` — `loggedInUserId` and
 * `loggedInUsername`, both of which the visitor writes themselves. Two lines in
 * a browser console made anyone the coach. Identity now travels in an httpOnly
 * cookie holding this token, and every server path re-derives it from here
 * instead of believing what the client says it is.
 *
 * Signed, not stored, on purpose: a `sessions` table would mean a schema change
 * and a database round trip on every single request, for a site with one coach
 * and a few hundred trainees. The cost is that a token cannot be revoked before
 * it expires — see `SESSION_TTL_SECONDS` for how long that window is.
 *
 * Deliberately free of `next/headers`: the middleware runs on the Edge runtime
 * and imports this module, so everything here sticks to Web Crypto and the Web
 * base64 helpers, both of which exist in Node and on the Edge alike. Reading and
 * writing the cookie itself lives in `@/lib/authGuard`, which is Node-only.
 */

/* Named in their own module so the browser can learn the hint cookie's name
   without importing any of the signing code below. */
export { SESSION_COOKIE, USER_HINT_COOKIE } from "@/lib/sessionCookies";

/** A week of not signing in again. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** …or a month, when the sign-in screen's "remember me" was ticked. */
export const SESSION_TTL_REMEMBER_SECONDS = 60 * 60 * 24 * 30;

/* One list, shared with the browser's cosmetic check — see @/lib/adminUsernames. */
import { isAdminUsername } from "@/lib/adminUsernames";
export { isAdminUsername };

export interface Session {
  /** `accounts.id` — the signed-in account. */
  userId: string;
  username: string;
  isAdmin: boolean;
  /** Unix seconds. */
  expiresAt: number;
  /**
   * When this token was minted, unix seconds.
   *
   * The token cannot be revoked — it is a signature, not a row — so this is what
   * lets a later event disown it. `accounts.password_changed_at` is compared
   * against it, and a token older than the last password change is refused. See
   * `sessionRefusal` in `@/lib/authGuard`.
   */
  issuedAt: number;
}

/** What actually goes into the token, kept short because it rides on every request. */
interface TokenPayload {
  /** Subject: `accounts.id`. */
  s: string;
  /** Username. */
  u: string;
  /** Expiry, unix seconds. */
  e: number;
  /** Issued at, unix seconds. */
  i: number;
}

/* Bumped if the payload shape ever changes, so old tokens are rejected rather
   than misread.
 *
 * v1 → v2 added `i`. A v1 token cannot be checked against a password change,
 * because it does not say when it was issued — and "cannot be checked" has to
 * mean refused, or the gap this version exists to close would stay open for
 * every session already outstanding. The cost is that everyone signs in once
 * more after this deploys. */
const TOKEN_VERSION = "v2";

/* Only ever used when SESSION_SECRET is unset outside production, so that
   `npm run dev` still signs someone in on a fresh clone. Production throws
   instead — a predictable signing key there would mean anyone could mint a
   coach's session. */
const DEV_ONLY_FALLBACK_SECRET = "insecure-development-only-session-key-do-not-use-in-production";

let warnedAboutFallback = false;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. Generate one with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
        "and set it in the deployment environment."
    );
  }

  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      secret
        ? "[session] SESSION_SECRET is shorter than 32 characters; using the development fallback key."
        : "[session] SESSION_SECRET is not set; using the development fallback key. Set it before deploying."
    );
  }
  return DEV_ONLY_FALLBACK_SECRET;
}

/* Importing the key is asynchronous, and the secret does not change while the
   process lives, so it is imported once and reused. Keyed by the secret itself
   so a changed value in dev is picked up rather than cached forever. */
let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null;

function signingKey(): Promise<CryptoKey> {
  const secret = sessionSecret();
  if (cachedKey?.secret === secret) return cachedKey.key;

  const key = crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  cachedKey = { secret, key };
  return key;
}

/* base64url by hand rather than Buffer: Buffer does not exist on the Edge, and
   the payload holds Arabic usernames, so it goes through TextEncoder first —
   btoa alone throws on anything outside Latin-1. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* Backed by an explicit ArrayBuffer, not the `ArrayBufferLike` a bare
   `new Uint8Array(n)` is typed as: `crypto.subtle.verify` takes a BufferSource,
   which a possibly-shared buffer does not satisfy. */
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Mints a token for an account. `ttlSeconds` decides how long it stays valid —
 * the cookie's own Max-Age is set to match, but the expiry inside the signature
 * is the one that counts, since a cookie's lifetime is the client's to edit.
 */
export async function createSessionToken(
  account: { id: string; username: string },
  ttlSeconds: number = SESSION_TTL_SECONDS
): Promise<{ token: string; expiresAt: number }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const payload: TokenPayload = { s: account.id, u: account.username, e: expiresAt, i: issuedAt };

  const body = `${TOKEN_VERSION}.${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    new TextEncoder().encode(body)
  );

  return { token: `${body}.${bytesToBase64Url(new Uint8Array(signature))}`, expiresAt };
}

/**
 * The session a token stands for, or null if it was tampered with, signed by a
 * different key, malformed, or has run out.
 *
 * Never throws on bad input: a forged cookie is an ordinary thing to receive
 * from the open internet, and the answer to it is "not signed in", not a 500.
 */
export async function verifySessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [version, encodedPayload, encodedSignature] = parts;
  if (version !== TOKEN_VERSION) return null;

  /* Resolved before the try, deliberately. A missing SESSION_SECRET is a broken
     deployment, not a forged cookie, and folding the two together is how it
     would present: every request quietly unauthenticated, every sign-in
     bouncing straight back to the sign-in screen, and nothing in the logs to
     say why. Let it throw. */
  const key = await signingKey();

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(encodedSignature),
      new TextEncoder().encode(`${version}.${encodedPayload}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload))) as TokenPayload;
    if (
      typeof payload?.s !== "string" ||
      typeof payload?.u !== "string" ||
      typeof payload?.e !== "number" ||
      typeof payload?.i !== "number"
    ) {
      return null;
    }
    if (payload.e <= Math.floor(Date.now() / 1000)) return null;

    return {
      userId: payload.s,
      username: payload.u,
      /* Derived on every read rather than carried in the token: taking an
         account off the admin list has to take effect on the next request, not
         whenever their cookie happens to expire. */
      isAdmin: isAdminUsername(payload.u),
      expiresAt: payload.e,
      issuedAt: payload.i,
    };
  } catch {
    return null;
  }
}
