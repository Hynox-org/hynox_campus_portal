// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SharedDashboardSwitch from "./shared-dashboard-switch";

afterEach(() => {
  cleanup();
  document.cookie = "campus-dashboard-role=; Max-Age=0; path=/";
});

it("keeps the normal user's name", () => {
  render(<SharedDashboardSwitch userName="Normal User" userMeta="Campus" />);
  expect(screen.getByText("Normal User")).toBeTruthy();
  expect(screen.getByText("Campus")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Switch Dashboard" })).toBeNull();
});

it("replaces the shared user's name with dashboard switching", () => {
  document.cookie = "campus-dashboard-role=auth-1:teacher; path=/";
  render(<SharedDashboardSwitch userName="Shared User" userMeta="Shared Profile" />);
  expect(screen.queryByText("Shared User")).toBeNull();
  expect(screen.queryByText("Shared Profile")).toBeNull();
  expect(screen.getByRole("link", { name: "Switch Dashboard" }).getAttribute("href")).toBe("/super-admin-login/dashboards");
});
