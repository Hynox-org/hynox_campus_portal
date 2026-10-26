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
it("shows a safe error and allows retry after a rejected provider call", async () => {
  vi.mocked(signInWithGoogle).mockRejectedValue(new Error("private stack trace"));render(<LoginPage/>);
  fireEvent.click(screen.getByRole("button",{name:"Sign In with Google"}));
  expect((await screen.findByRole("alert")).textContent).not.toContain("private");
  await waitFor(()=>expect(screen.getByRole("button",{name:"Sign In with Google"}).hasAttribute("disabled")).toBe(false));
});
it.each(["AccountMismatch","AccountUnavailable","OAuthExchangeFailed"])("explains the %s callback failure", async error => {
  window.history.replaceState(null,"",`/login?error=${error}`);render(<LoginPage/>);expect((await screen.findByRole("alert")).textContent).toBeTruthy();
});
