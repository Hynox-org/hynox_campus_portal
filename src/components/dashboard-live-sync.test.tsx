// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), receive: null as null | ((event: { new: { domain: string } }) => void), status: null as null | ((status: string) => void), remove: vi.fn(), select: vi.fn() }));
const router = { refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ usePathname: () => "/teacher", useRouter: () => router }));
vi.mock("@/utils/supabase/client", () => ({ createClient: () => {
  const channel = { on: (_: unknown, __: unknown, callback: typeof mocks.receive) => { mocks.receive = callback; return channel; },
    subscribe: (callback: typeof mocks.status) => { mocks.status = callback; return channel; } };
  return { channel: () => channel, removeChannel: mocks.remove, schema: () => ({ from: () => ({ select: mocks.select }) }) };
} }));
import { DashboardLiveSync } from "./dashboard-live-sync";
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.select.mockResolvedValue({ data: [], error: null }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
function setup() {
  const client = new QueryClient();
  client.setQueryData(["academic-prefetch", "campus"], { title: "Before" });
  client.setQueryData(["unrelated"], "unchanged");
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const view = render(<QueryClientProvider client={client}><DashboardLiveSync /></QueryClientProvider>);
  return { client, invalidate, ...view };
}
it("coalesces repeated revision events and only invalidates the matching domain", async () => {
  const { client, invalidate } = setup();
  act(() => { mocks.receive?.({ new: { domain: "academic" } }); mocks.receive?.({ new: { domain: "academic" } }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(["academic-prefetch", "campus"])?.isInvalidated).toBe(true);
  expect(client.getQueryState(["unrelated"])?.isInvalidated).toBe(false);
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("refreshes server mapping props after an identity change and cleans up", async () => {
  const { unmount } = setup();
  act(() => mocks.receive?.({ new: { domain: "identity" } }));
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(mocks.refresh).toHaveBeenCalledOnce();
  unmount();
  expect(mocks.remove).toHaveBeenCalledOnce();
  act(() => mocks.receive?.({ new: { domain: "identity" } }));
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.select).not.toHaveBeenCalled();
});
it("resynchronizes after reconnect and ignores unexpected payloads", async () => {
  const { invalidate } = setup();
  act(() => mocks.receive?.({ new: { domain: "unknown" } }));
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(invalidate).not.toHaveBeenCalled();
  act(() => mocks.status?.("SUBSCRIBED"));
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(invalidate).toHaveBeenCalledOnce();
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
