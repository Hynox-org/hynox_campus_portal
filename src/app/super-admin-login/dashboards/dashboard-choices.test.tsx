// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("../actions", () => ({ chooseSharedDashboard: vi.fn() }));
import { chooseSharedDashboard } from "../actions";
import DashboardChoices from "./dashboard-choices";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("shows immediate progress and prevents duplicate or competing selections", () => {
  vi.mocked(chooseSharedDashboard).mockReturnValue(new Promise(() => {}));
  render(<DashboardChoices availableRoles={["super_admin", "teacher", "student", "institution_admin"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Teacher", exact: true }));
  expect(screen.getByRole("status").textContent).toContain("Please wait");
  expect(screen.getByRole("button", { name: "Opening Teacher…" }).hasAttribute("disabled")).toBe(true);
  const admin = screen.getByRole("button", { name: "Admin", exact: true });
  expect(admin.hasAttribute("disabled")).toBe(true);
  fireEvent.submit(admin.closest("form")!);
  expect(chooseSharedDashboard).toHaveBeenCalledTimes(1);
  expect(vi.mocked(chooseSharedDashboard).mock.calls[0][0].get("role")).toBe("teacher");
});

it("shows an error and allows retry when saving the selected role fails", async () => {
  vi.mocked(chooseSharedDashboard).mockRejectedValue(new Error("Request failed"));
  render(<DashboardChoices availableRoles={["teacher"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Teacher", exact: true }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Please try again"));
  expect(screen.getByRole("button", { name: "Teacher", exact: true }).hasAttribute("disabled")).toBe(false);
  expect(screen.queryByRole("status")).toBeNull();
});
