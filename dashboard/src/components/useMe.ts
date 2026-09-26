"use client";

import { useEffect, useState } from "react";
import { getJSON } from "@/lib/client";

export interface Me {
  id: number;
  email: string | null;
  username: string | null;
  name: string | null;
  isAdmin: boolean;
  envAdmin: boolean;
  hasPassword: boolean;
  google: boolean;
  apiKey: string | null;
}

/** The signed-in user (null while loading or signed out). */
export function useMe(): { me: Me | null; setMe: (m: Me) => void; loaded: boolean } {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    getJSON<{ user: Me }>("/api/auth/me")
      .then((r) => setMe(r.user))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  return { me, setMe, loaded };
}
