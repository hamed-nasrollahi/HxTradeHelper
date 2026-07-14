"use client";

import { useEffect, useState } from "react";
import { getJSON } from "@/lib/client";

export interface Meta {
  symbols: string[];
  accounts: number[];
  strategies: { id: number; name: string; color: string }[];
  mistakes: { id: number; name: string }[];
}

export function useMeta(): { meta: Meta; error: string | null; reload: () => void } {
  const [meta, setMeta] = useState<Meta>({ symbols: [], accounts: [], strategies: [], mistakes: [] });
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getJSON<Meta>("/api/meta")
      .then((m) => {
        setMeta(m);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [tick]);

  return { meta, error, reload: () => setTick((t) => t + 1) };
}
