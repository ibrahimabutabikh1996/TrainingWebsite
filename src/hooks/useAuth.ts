import { useState } from "react";
import { useRouter } from "next/navigation";

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
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || fallbackErrorMessage);
        return false;
      }
      
      if (remember) {
        localStorage.setItem("remember", "true");
      }
      localStorage.setItem("loggedInUserId", data.userId);
      localStorage.setItem("loggedInUsername", data.username);
      
      if (data.username === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
      return true;
    } catch (err) {
      setError(fallbackErrorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("loggedInUserId");
    localStorage.removeItem("loggedInUsername");
    localStorage.removeItem("remember");
    router.push("/");
  };

  return { login, logout, isLoading, error, setError };
}
