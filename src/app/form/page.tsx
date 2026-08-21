import { getLandingContent } from "../admin/cms/actions";
import { resolvePlanNames } from "@/lib/planNames";
import FormClient from "./FormClient";
import type { JsonRecord } from "@/types";

/**
 * The intake form, with the packages named as the coach named them.
 *
 * The questionnaire itself is a client component and always was — it holds four
 * steps of local state and reads `?plan=` off the URL. What this wrapper adds is
 * the one thing it could not fetch for itself: the contents of `site_settings`,
 * where the panel stores what each plan and offer is called.
 *
 * Without it the form had its own fixed copy of those six names, so renaming a
 * package in the panel changed the card on the landing page and left the form,
 * and the WhatsApp message it composes, saying the old one.
 *
 * The same split the home page uses — a server page that reads the row, a
 * client component that renders it.
 */
export const dynamic = "force-dynamic";

export default async function FormPage() {
  const settings = await getLandingContent();
  const planNames = resolvePlanNames(
    settings ? (settings.content_ar as JsonRecord) : null,
  );

  return <FormClient planNames={planNames} />;
}
