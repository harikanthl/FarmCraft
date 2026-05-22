import { useEffect, useState } from "react";
import type { FarmDotsDatabase } from "@/db/types";
import { getDatabase } from "@/db/init";

export function useDatabase(): {
  db: FarmDotsDatabase | null;
  dbError: Error | null;
  dbLoading: boolean;
} {
  const [db, setDb] = useState<FarmDotsDatabase | null>(null);
  const [dbError, setDbError] = useState<Error | null>(null);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getDatabase()
      .then((d) => {
        if (!cancelled) {
          setDb(d);
          setDbError(null);
        }
      })
      .catch((e: unknown) => {
        console.error("[FarmDots] RxDB init failed", e);
        if (!cancelled) {
          setDbError(e instanceof Error ? e : new Error(String(e)));
        }
      })
      .finally(() => {
        if (!cancelled) setDbLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { db, dbError, dbLoading };
}
