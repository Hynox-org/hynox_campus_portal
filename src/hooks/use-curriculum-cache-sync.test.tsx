// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useCurriculumCacheSync } from "./use-curriculum-cache-sync";
afterEach(cleanup);
it("updates an already opened tree after an external invalidation without navigating away", async () => {
  const client = new QueryClient();
  const read = vi.fn().mockResolvedValue([{ title: "Original lesson" }]);
  await client.fetchQuery({ queryKey: ["academic-lessons", "module"], queryFn: read });
  function Tree() {
    const [cache, setCache] = useState<Record<string, Array<{ title: string }>>>({ module: client.getQueryData(["academic-lessons", "module"])! });
    useCurriculumCacheSync("academic-lessons", setCache);
    return <div>{cache.module[0].title}</div>;
  }
  render(<QueryClientProvider client={client}><Tree /></QueryClientProvider>);
  expect(screen.getByText("Original lesson")).toBeTruthy();
  read.mockResolvedValue([{ title: "Other teacher's edit" }]);
  await act(async () => { await client.invalidateQueries({ queryKey: ["academic-lessons"] }); });
  await waitFor(() => expect(screen.getByText("Other teacher's edit")).toBeTruthy());
  expect(read).toHaveBeenCalledTimes(2);
});
