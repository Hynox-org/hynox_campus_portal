// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/app/actions/auth-actions",()=>({signOutAction:vi.fn()}));
vi.mock("@/lib/auth-logout",()=>({notifySignOut:vi.fn()}));
const {showError}=vi.hoisted(()=>({showError:vi.fn()}));
vi.mock("./toast",()=>({useToast:()=>({showError})}));
import { signOutAction } from "@/app/actions/auth-actions";
import { notifySignOut } from "@/lib/auth-logout";
import SignOutButton from "./sign-out-button";
beforeEach(()=>{vi.clearAllMocks();});afterEach(cleanup);
it.each([false,true])("notifies other tabs only after successful sign-out (compact=%s)",async compact=>{
  vi.mocked(signOutAction).mockResolvedValue({redirectTo:"/login"});
  render(<SignOutButton compact={compact}/>);
  fireEvent.click(screen.getByRole("button",{name:/Sign Out/i}));
  await waitFor(()=>expect(notifySignOut).toHaveBeenCalledExactlyOnceWith("/login"));
  expect(showError).not.toHaveBeenCalled();
});
it("keeps tabs untouched and shows a safe error when server sign-out fails",async()=>{
  vi.mocked(signOutAction).mockRejectedValue(new Error("private auth details"));
  render(<SignOutButton/>);
  fireEvent.click(screen.getByRole("button",{name:/Sign Out/i}));
  await waitFor(()=>expect(showError).toHaveBeenCalledWith("Unable to sign out. Please try again."));
  expect(notifySignOut).not.toHaveBeenCalled();
});
