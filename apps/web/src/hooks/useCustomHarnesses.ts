"use client";

import type { HarnessTemplate } from "@nexora/shared";
import { useCallback, useEffect, useState } from "react";
import { listCustomHarnesses } from "@/lib/harness/customHarnessRegistry";

export function useCustomHarnesses() {
  const [harnesses, setHarnesses] = useState<HarnessTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refreshHarnesses = useCallback(() => {
    setHarnesses(listCustomHarnesses());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refreshHarnesses();
    window.addEventListener("focus", refreshHarnesses);
    window.addEventListener("storage", refreshHarnesses);

    return () => {
      window.removeEventListener("focus", refreshHarnesses);
      window.removeEventListener("storage", refreshHarnesses);
    };
  }, [refreshHarnesses]);

  return {
    harnesses,
    loaded,
    refreshHarnesses,
  };
}
