// @vitest-environment jsdom
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { formatCampusDate } from "./display-date";

it("hydrates the Teacher timeline without recovering when browser defaults differ from SSR", async () => {
  const defaultDate = vi.spyOn(Date.prototype, "toLocaleDateString").mockReturnValue("1/10/2026");
  const Timeline = () => <p>{formatCampusDate("2026-10-01")} – {formatCampusDate("2026-12-30")}</p>;
  const container = document.createElement("div");
  container.innerHTML = renderToString(<Timeline />);
  document.body.append(container);
  defaultDate.mockReturnValue("01/10/2026");
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(container, <Timeline />, { onRecoverableError: error => errors.push(error) }); });
    expect(container.textContent).toBe("01/10/2026 – 30/12/2026");
    expect(errors).toEqual([]);
  } finally {
    await act(async () => root?.unmount()); container.remove(); defaultDate.mockRestore();
  }
});
