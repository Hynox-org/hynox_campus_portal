// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("./actions", () => ({ sharedSignIn: vi.fn() }));
vi.mock("@/components/particle-field", () => ({ default: () => null }));
import { sharedSignIn } from "./actions";
import SharedLoginPage from "./page";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function submitLogin() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "shared@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
}

it("shows sign-in progress and blocks repeated submissions", () => {
  vi.mocked(sharedSignIn).mockReturnValue(new Promise(() => {}));
  render(<SharedLoginPage />);
  submitLogin();
  expect(screen.getByRole("status").textContent).toContain("Please wait");
  expect(screen.getByRole("button", { name: "Signing in…" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByLabelText("Email").hasAttribute("disabled")).toBe(true);
  expect(screen.getByLabelText("Password").hasAttribute("disabled")).toBe(true);
  fireEvent.submit(screen.getByRole("button").closest("form")!);
  expect(sharedSignIn).toHaveBeenCalledTimes(1);
  expect(vi.mocked(sharedSignIn).mock.calls[0][0].get("email")).toBe("shared@example.com");
});

it.each(["credentials", "network"])("restores the form after a %s error", async failure => {
  if (failure === "credentials") vi.mocked(sharedSignIn).mockResolvedValue({ error: "Check your email and password." });
  else vi.mocked(sharedSignIn).mockRejectedValue(new Error("Network failed"));
  render(<SharedLoginPage />);
  submitLogin();
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("button", { name: "Sign In" }).hasAttribute("disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  await waitFor(() => expect(sharedSignIn).toHaveBeenCalledTimes(2));
});
