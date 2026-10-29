// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/app/actions/auth-actions", () => ({ signInWithGoogle: vi.fn() }));
vi.mock("@/components/particle-field", () => ({ default: () => null }));
import { signInWithGoogle } from "@/app/actions/auth-actions";
import LoginPage from "./page";
beforeEach(() => {vi.clearAllMocks();window.history.replaceState(null,"","/login");});
afterEach(cleanup);
it("prevents repeated OAuth initialization while pending", () => {
  vi.mocked(signInWithGoogle).mockReturnValue(new Promise(()=>{}));render(<LoginPage/>);
  const button=screen.getByRole("button",{name:"Sign In with Google"});fireEvent.click(button);fireEvent.click(button);
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);expect(button.hasAttribute("disabled")).toBe(true);
});
it("allows a fresh sign-in when browser Back restores the pending OAuth page", () => {
  vi.mocked(signInWithGoogle).mockReturnValue(new Promise(()=>{}));
  render(<LoginPage/>);
  fireEvent.click(screen.getByRole("button", { name: "Sign In with Google" }));
  fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
  const button = screen.getByRole("button", { name: "Sign In with Google" });
  expect(button.hasAttribute("disabled")).toBe(false);
  fireEvent.click(button);
  expect(signInWithGoogle).toHaveBeenCalledTimes(2);
});
it("shows a safe error and allows retry after a rejected provider call", async () => {
  vi.mocked(signInWithGoogle).mockRejectedValue(new Error("private stack trace"));render(<LoginPage/>);
  fireEvent.click(screen.getByRole("button",{name:"Sign In with Google"}));
  expect((await screen.findByRole("alert")).textContent).not.toContain("private");
  await waitFor(()=>expect(screen.getByRole("button",{name:"Sign In with Google"}).hasAttribute("disabled")).toBe(false));
});
it.each(["AccountMismatch","AccountUnavailable","OAuthExchangeFailed"])("explains the %s callback failure", async error => {
  window.history.replaceState(null,"",`/login?error=${error}`);render(<LoginPage/>);expect((await screen.findByRole("alert")).textContent).toBeTruthy();
});
it("explains access denial from the provider fragment without displaying raw details", async () => {
  window.history.replaceState(null,"","/login?error=OAuthExchangeFailed#error=access_denied&error_description=private-details");
  render(<LoginPage/>);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("denied or cancelled");
  expect(alert.textContent).not.toContain("private-details");
});
