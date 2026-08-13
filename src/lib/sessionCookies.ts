/* Just the two cookie names, in a module of their own.
 *
 * The browser needs one of them and the server needs both, and the server's
 * copy lives next to the signing key in `@/lib/session`. Naming them here keeps
 * one definition of each without pulling the token machinery into the client
 * bundle to get at a string.
 */

/** Holds the signed session token. httpOnly — script can never read it. */
export const SESSION_COOKIE = "gym_session";

/**
 * A copy of the username, readable by script, for deciding which button to draw.
 *
 * It carries no authority whatsoever: forging it changes nothing, because every
 * server path reads `SESSION_COOKIE` and verifies its signature instead.
 */
export const USER_HINT_COOKIE = "gym_user";
