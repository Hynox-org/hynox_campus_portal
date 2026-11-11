import { expect, it, vi } from "vitest";
import { formatCampusDate, formatCampusDateTime } from "./display-date";
it("renders the reported Teacher timeline with fixed zero-padded dates", () => {
  expect(`${formatCampusDate("2026-10-01")} – ${formatCampusDate("2026-12-30")}`).toBe("01/10/2026 – 30/12/2026");
});
it("does not depend on default browser locale date methods", () => {
  const date = vi.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(() => { throw new Error("default locale differs"); });
  const time = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(() => { throw new Error("default locale differs"); });
  try {
    expect(formatCampusDateTime("2026-10-29T19:00:00Z")).toBe("30/10/2026 00:30");
  } finally { date.mockRestore(); time.mockRestore(); }
});
it.each([null, undefined, "", "not-a-date"])("uses a stable fallback for missing or invalid dates", value => {
  expect(formatCampusDate(value)).toBe("—"); expect(formatCampusDateTime(value)).toBe("—");
});
