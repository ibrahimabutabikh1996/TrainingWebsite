"use client";

import { useEffect, useState } from "react";
import { getLandingContent } from "@/app/admin/cms/actions";
import { DEFAULT_PLAN_NAMES, resolvePlanNames, type PlanNames } from "@/lib/planNames";
import type { JsonRecord } from "@/types";

/* The package names for a screen with no server component above it to hand
 * them down.
 *
 * Everywhere else — the form, the subscriber list, the profile page, the PDF
 * export — a server component reads `site_settings` and passes the names in as
 * a prop, which is both cheaper and free of any flash of the wrong name. The
 * trainee's dashboard cannot: it is a client component from its first line and
 * is served as a static page, so giving it a server parent would make every
 * visit render on demand to fetch six strings.
 *
 * So it asks afterwards. The dictionary answers until the row arrives, which
 * means a renamed package may show its old name for the first moment of the
 * page. That is the trade this hook exists to make, and it is only acceptable
 * here: the dashboard shows a subscription that already exists, where the name
 * is a label. On the form it would be the name in a message about to be sent to
 * the coach, which is why the form does not use this.
 *
 * `getLandingContent` is a server action with no admin guard — the landing page
 * calls it from the browser too — so this costs one round trip and reads
 * nothing a visitor could not already see.
 */
export function usePlanNames(): PlanNames {
  const [names, setNames] = useState<PlanNames>(DEFAULT_PLAN_NAMES);

  useEffect(() => {
    let cancelled = false;

    getLandingContent()
      .then((settings) => {
        if (cancelled || !settings) return;
        setNames(resolvePlanNames(settings.content_ar as JsonRecord));
      })
      /* A name that stays as the dictionary has it is a far smaller problem
         than a dashboard that fails to render, so this stays quiet. */
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return names;
}
