import { expect, it } from "vitest";
import { readAllPages, readByIds } from "./query-pages";
it("retrieves all 1001 rows over three bounded pages", async () => {
  const source = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const pages: number[][] = [];
  const rows = await readAllPages(async (from, to) => { pages.push([from, to]); return { data: source.slice(from, to + 1), error: null }; });
  expect(rows).toEqual(source); expect(pages).toEqual([[0, 499], [500, 999], [1000, 1499]]);
});
it("does not return partial analytics when a later page fails", async () => {
  await expect(readAllPages(async from => from === 0 ? { data: Array(500).fill(1), error: null } : { data: null, error: new Error("later page failed") })).rejects.toThrow("later page failed");
});
it("deduplicates IDs and bounds filters and parallel reads", async () => {
  const ids = Array.from({ length: 501 }, (_, id) => String(id));
  let pending = 0, maximum = 0;
  const rows = await readByIds([...ids, ...ids], async group => {
    expect(group.length).toBeLessThanOrEqual(100); pending++; maximum = Math.max(maximum, pending);
    await Promise.resolve(); pending--; return { data: group, error: null };
  });
  expect(rows).toEqual(ids); expect(maximum).toBeLessThanOrEqual(4);
});
