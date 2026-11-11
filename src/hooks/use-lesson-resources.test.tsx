// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
vi.mock("@/app/actions/academic-actions", () => ({ listLessonResourcesAction: vi.fn() }));
import { listLessonResourcesAction } from "@/app/actions/academic-actions";
import { useLessonResources } from "./use-lesson-resources";
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listLessonResourcesAction).mockResolvedValue({ success: true, resources: [] }); });
afterEach(cleanup);
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, Wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
it("does not query until a lesson is selected", async () => {
  const { Wrapper } = wrapper();
  renderHook(() => useLessonResources(), { wrapper: Wrapper });
  expect(listLessonResourcesAction).not.toHaveBeenCalled();
});
it("reuses fresh attachments and refreshes invalidated data", async () => {
  const { client, Wrapper } = wrapper();
  const { result, rerender } = renderHook(({ id }) => useLessonResources(id), { initialProps: { id: "one" }, wrapper: Wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  rerender({ id: "two" });
  await waitFor(() => expect(listLessonResourcesAction).toHaveBeenCalledTimes(2));
  rerender({ id: "one" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(listLessonResourcesAction).toHaveBeenCalledTimes(2);
  await act(async () => { await client.invalidateQueries({ queryKey: ["academic-resources", "one"] }); });
  expect(listLessonResourcesAction).toHaveBeenCalledTimes(3);
});
it("a late response from the previous lesson cannot replace the current lesson's files", async () => {
  const { Wrapper } = wrapper();
  let completeFirst!: (value: { success: boolean, resources: Array<{ id: string; title: string }> }) => void;
  vi.mocked(listLessonResourcesAction).mockImplementationOnce(() => new Promise(resolve => { completeFirst = resolve; }));
  const { result, rerender } = renderHook(({ id }) => useLessonResources(id), { initialProps: { id: "one" }, wrapper: Wrapper });
  vi.mocked(listLessonResourcesAction).mockResolvedValue({ success: true, resources: [{ id: "new", title: "Current lesson PDF" }] });
  rerender({ id: "two" });
  await waitFor(() => expect(result.current.data?.[0]?.id).toBe("new"));
  await act(async () => completeFirst({ success: true, resources: [{ id: "old", title: "Previous lesson PDF" }] }));
  expect(result.current.data?.[0]?.id).toBe("new");
  expect(listLessonResourcesAction).toHaveBeenLastCalledWith("two");
});
it("surfaces errors and retries instead of caching failure as an empty resource list", async () => {
  const { Wrapper } = wrapper();
  vi.mocked(listLessonResourcesAction).mockResolvedValueOnce({ error: "Network unavailable" });
  const { result } = renderHook(() => useLessonResources("one"), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.error?.message).toBe("Network unavailable"));
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
});

it("refreshes expired attachments instead of serving an indefinitely stale local copy", async () => {
  const { client, Wrapper } = wrapper();
  client.setQueryData(["academic-resources", "one"], [{ id: "old", title: "Old file" }], { updatedAt: Date.now() - 61000 });
  vi.mocked(listLessonResourcesAction).mockResolvedValue({ success: true, resources: [{ id: "new", title: "Replacement file" }] });
  const { result } = renderHook(() => useLessonResources("one"), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.data?.[0]?.id).toBe("new"));
  expect(listLessonResourcesAction).toHaveBeenCalledTimes(1);
});
