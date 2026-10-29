"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Bridge the existing tree's imperative cache to background query updates. */
export function useCurriculumCacheSync<T>(prefix: string, setCache: Dispatch<SetStateAction<Record<string, T[]>>>) {
  const client = useQueryClient();
  useEffect(() => client.getQueryCache().subscribe(event => {
    if (event.type !== "updated" || event.query.queryKey[0] !== prefix) return;
    const id = String(event.query.queryKey[1]);
    if (event.action.type === "invalidate") {
      void client.refetchQueries({ queryKey: event.query.queryKey, exact: true, type: "all" });
    } else if (event.action.type === "success" && Array.isArray(event.query.state.data)) {
      setCache(previous => ({ ...previous, [id]: event.query.state.data as T[] }));
    }
  }), [client, prefix, setCache]);
}
