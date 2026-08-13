/* The registration answers, with the credentials taken back out.
 *
 * The intake form asks for a username and a password so a new trainee can sign
 * in afterwards. `/api/submit-form` does the right thing with them — hashes the
 * password into `accounts` — and then did the wrong thing too: it spread the
 * whole submitted payload into `profiles.data`, credentials included. So every
 * registration left a second copy of the password, in plain text, in a jsonb
 * column that is handed to the dashboard as `raw_answers` and to the coach's
 * panel in full.
 *
 * Two defences, because they fail differently:
 *
 *   - `CREDENTIAL_KEYS` is stripped at the write, so nothing new is stored.
 *   - `withoutCredentials` is applied at every read, so a row written before
 *     this — or restored from an old backup — cannot leak either.
 *
 * The read side is the one that matters most. A cleanup pass is a moment in
 * time; a filter on the way out holds regardless of what is in the column.
 */

import type { JsonRecord } from "@/types";

/** Never stored in, and never read out of, the intake blob. */
export const CREDENTIAL_KEYS = ["password", "username"] as const;

/**
 * A copy of the blob with the credentials removed, including from the monthly
 * snapshots kept under `history` — a renewal copies the previous answers there
 * wholesale, so a password stored once outlives the month it was submitted in.
 *
 * `username` goes too. It is not a secret, but it is half of one, and nothing
 * reads it from here: the account's own username comes from `accounts`.
 */
export function withoutCredentials(blob: unknown): JsonRecord {
  if (!blob || typeof blob !== "object" || Array.isArray(blob)) return {};

  const clean: JsonRecord = { ...(blob as JsonRecord) };
  for (const key of CREDENTIAL_KEYS) delete clean[key];

  if (Array.isArray(clean.history)) {
    clean.history = clean.history.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
      const month = entry as JsonRecord;
      if (!month.data || typeof month.data !== "object" || Array.isArray(month.data)) return month;
      const monthData: JsonRecord = { ...(month.data as JsonRecord) };
      for (const key of CREDENTIAL_KEYS) delete monthData[key];
      return { ...month, data: monthData };
    });
  }

  return clean;
}

/** Parses the column — older rows hold a string — and strips in one step. */
export function readIntakeData(raw: unknown): JsonRecord {
  if (typeof raw === "string") {
    try {
      return withoutCredentials(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return withoutCredentials(raw);
}
