import { useState, useEffect } from "react";

/** How long the exit animation plays (ms). Must match the CSS transition in DashboardLoader. */
const EXIT_MS = 450;

/**
 * Returns { showLoader, exiting } so the caller can:
 *   - keep <DashboardLoader> in the DOM while exiting (for its fade-out animation)
 *   - start rendering the dashboard underneath during the exit phase
 *
 * Timeline:
 *   LOADING  →  (both data ready + minTime elapsed)  →  EXITING (EXIT_MS)  →  DONE
 */
export function useMinimumLoadingState(
  isLoading: boolean,
  minDurationMs = 3000
): { showLoader: boolean; exiting: boolean } {
  const [minDone, setMinDone] = useState(false);
  const [phase, setPhase] = useState<"loading" | "exiting" | "done">("loading");

  /* Start minimum-duration timer on mount */
  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), minDurationMs);
    return () => clearTimeout(t);
  }, [minDurationMs]);

  /* When both the query and the min-timer are done, run the exit phase */
  useEffect(() => {
    if (!isLoading && minDone && phase === "loading") {
      setPhase("exiting");
      const t = setTimeout(() => setPhase("done"), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [isLoading, minDone, phase]);

  return {
    showLoader: phase !== "done",   // keep loader in DOM while loading OR exiting
    exiting: phase === "exiting",   // true only during the exit animation window
  };
}
