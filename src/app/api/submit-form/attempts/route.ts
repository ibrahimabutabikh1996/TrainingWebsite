import { NextResponse } from "next/server";
import { clientAddress, peekAttempts, SUBMIT_FORM_LIMIT } from "@/lib/rateLimit";

/* How many submissions this address has left, for the line above the form's
   submit button. Reads the same counter `/api/submit-form` spends — the
   address key, which every submission takes first — without spending from it.

   A visitor once failed validation until the limit closed, reloaded, filled the
   whole form in again and was refused twice more with no idea why or for how
   long. The count comes from here rather than being kept in the browser so a
   reload cannot reset it. */
export async function GET(request: Request) {
  const left = await peekAttempts(`submit-form:${clientAddress(request)}`, SUBMIT_FORM_LIMIT);
  return NextResponse.json(left, { headers: { "Cache-Control": "no-store" } });
}
