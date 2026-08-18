import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminUsername } from "@/lib/adminUsernames";
import { notifySessionChanged } from "@/lib/clientSession";

export function useAuth() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (username: string, password: string, remember: boolean, fallbackErrorMessage: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        /* `remember` goes to the server now: it decides the session cookie's
           lifetime, so keeping it only in localStorage meant "remember me" had
           no effect on how long the session actually lasted. */
        body: JSON.stringify({ username, password, remember }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || fallbackErrorMessage);
        return false;
      }
      
      /* Nothing about who is signed in is written here any more. It used to
         keep `loggedInUserId` and `loggedInUsername` in localStorage and the
         rest of the app read them as identity — values the visitor can edit.
         The session cookie the server sets is the only record now, and the
         readable half of it (`currentUsername`) is drawn from that. */
      notifySessionChanged();

      /* The server already decided this and put it in the session; trusting its
         answer keeps the redirect and the proxy's admin check from ever
         disagreeing about who the coach is. */
      if (data.isAdmin ?? isAdminUsername(data.username)) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
      return true;
    } catch {
      setError(fallbackErrorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    /* The session cookie is httpOnly, so clearing localStorage no longer signs
       anyone out — only the server can drop it. /api/auth/logout existed for
       this and was never called; without it a "signed out" browser kept a
       working session and could walk straight back into /dashboard. */
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* Network failure shouldn't strand the user on a page they asked to
         leave: clear what we can and move on. The cookie's own TTL still
         bounds the damage. */
    }
    /* Both cookies are cleared by the server above. This tells the screens
       reading the username hint that it has gone, since a cookie fires no
       event of its own. */
    notifySessionChanged();
    router.push("/");
  };

  return { login, logout, isLoading, error, setError };
}
