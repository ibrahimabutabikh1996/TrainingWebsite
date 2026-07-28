import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/types";

export function useProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("loggedInUserId");
    if (!userId) {
      router.push("/");
      return;
    }

    fetch(`/api/profile?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.profile) {
          setProfile(data.profile);
        } else {
          setError(data.error || "Failed to load profile");
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching profile:", err);
        setError("Error fetching profile");
        setLoading(false);
      });
  }, [router]);

  return { profile, loading, error };
}
