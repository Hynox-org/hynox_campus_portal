// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import InstitutionUserTable from "./institution-user-table";
afterEach(cleanup);
const users = Array.from({ length: 2500 }, (_, index) => ({
  id: String(index), full_name: `Student ${index}`, email: `student${index}@example.invalid`,
  status: "active", created_at: "2026-10-26T00:00:00Z", roles: ["student"],
}));
it("renders one page of a 2500-user roster and keeps actions tied to the displayed user", () => {
  const onView = vi.fn(); const onDelete = vi.fn();
  render(<InstitutionUserTable users={users} onView={onView} onDelete={onDelete} />);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(11);
  expect(screen.queryByText("student10@example.invalid")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "View student10@example.invalid" }));
  expect(onView).toHaveBeenCalledWith(users[10]);
  fireEvent.click(screen.getByRole("button", { name: "Delete student10@example.invalid" }));
  expect(onDelete).toHaveBeenCalledWith(users[10]);
});
it("renders an empty roster without deletion controls", () => {
  render(<InstitutionUserTable users={[]} onView={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText("No results.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Delete / })).toBeNull();
});
