import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/types";

/* The signed-in trainee's own file.
 *
 * No id is sent and none is read from `localStorage`: `/api/profile` takes the
 * account from the session cookie. Passing one from here was the client naming
 * whose data it wanted, which is not a question the client gets to answer.
 */

type FetchResult =
  | { status: "ok"; profile: UserProfile }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

/* Deliberately outside the hook and free of state: the fetch says what came
   back, and the caller decides what to do about it. Written as one function
   that sets state itself, the only place it could be called from was inside an
   effect, which is what `react-hooks/set-state-in-effect` objects to — and the
   objection is fair, because "fetch, then set" and "set" are two different
   things and only one of them belongs to React. */
async function fetchProfile(bustCache: boolean): Promise<FetchResult> {
  const url = bustCache ? `/api/profile?t=${Date.now()}` : "/api/profile";
  const res = await fetch(url);

  /* The session has run out, or was never there. */
  if (res.status === 401) return { status: "unauthenticated" };

  const data = await res.json();
  if (data.success && data.profile) return { status: "ok", profile: data.profile };
  return { status: "error", message: data.error || "تعذّر تحميل الملف" };
}

export function useProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    (result: FetchResult) => {
      if (result.status === "unauthenticated") {
        router.push("/login");
        return;
      }
      if (result.status === "ok") setProfile(result.profile);
      else setError(result.message);
    },
    [router]
  );

  useEffect(() => {
    /* The response can arrive after the dashboard has been navigated away from;
       setting state then is a warning and a wasted render. */
    let cancelled = false;

    fetchProfile(false)
      .then((result) => {
        if (!cancelled) apply(result);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error fetching profile:", err);
        setError("حدث خطأ أثناء جلب الملف");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apply]);

  const reload = useCallback(() => {
    fetchProfile(true).then(apply).catch(console.error);
  }, [apply]);

  return { profile, loading, error, reload };
}
