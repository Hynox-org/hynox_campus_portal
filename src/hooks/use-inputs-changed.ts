"use client";

import { useState, useSyncExternalStore } from "react";

/** Adjust local edit/selection state before children render a new server snapshot.
 * The guarded update follows React's previous-props pattern. Callers may only
 * update their own state here; subscriptions, requests and DOM work stay in effects.
 */
export function useInputsChanged(inputs: readonly unknown[]) {
  const [previous, setPrevious] = useState<readonly unknown[] | null>(null);
  const changed = previous === null || previous.length !== inputs.length || inputs.some((input, index) => !Object.is(input, previous[index]));
  if (changed) setPrevious(inputs);
  return changed;
}

const subscribe = () => () => {};
/** Keep the first browser render identical to SSR before reading browser state. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
