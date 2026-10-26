import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { signInWithGoogle, signInWithPasswordAction, signOutAction } from "./auth-actions";
import { sharedSignIn } from "@/app/super-admin-login/actions";
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));

describe("authentication actions", () => {
  const signInWithPassword = vi.fn(), signInWithOAuth = vi.fn(), signOut = vi.fn(), getUser = vi.fn(), remove = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({ auth: { signInWithPassword, signInWithOAuth, signOut, getUser } } as never);
    vi.mocked(cookies).mockResolvedValue({ delete: remove } as never);
    signOut.mockResolvedValue({error:null});getUser.mockResolvedValue({data:{user:{app_metadata:{}}}});
    signInWithPassword.mockResolvedValue({error:null});signInWithOAuth.mockResolvedValue({data:{url:"https://accounts.google.com/example"},error:null});
  });
  const form = (email: string | Blob, password: string | Blob) => {const input=new FormData();input.set("email",email);input.set("password",password);return input;};
  it.each([["", "pass"],["bad", "pass"],["valid@example.com", ""],["a".repeat(255)+"@example.com", "pass"],["valid@example.com", "p".repeat(4097)]])("rejects invalid credentials without calling the provider", async (email,password) => {
    expect(await signInWithPasswordAction(form(email,password))).toHaveProperty("error");
    expect(await sharedSignIn(form(email,password))).toHaveProperty("error");expect(createClient).not.toHaveBeenCalled();
  });
  it("rejects file values sent as credentials", async () => {
    expect(await signInWithPasswordAction(form(new Blob(["email"]),"password"))).toHaveProperty("error");
    expect(await sharedSignIn(form("a@example.com",new Blob(["password"])))).toHaveProperty("error");expect(createClient).not.toHaveBeenCalled();
  });
  it("trims email but preserves significant password whitespace", async () => {
    expect(await signInWithPasswordAction(form(" member@example.com "," pass "))).toEqual({success:true});
    expect(signInWithPassword).toHaveBeenCalledWith({email:"member@example.com",password:" pass "});
  });
  it("hides provider authentication diagnostics", async () => {
    signInWithPassword.mockResolvedValue({error:{message:"private provider details"}});
    expect(await signInWithPasswordAction(form("a@example.com","wrong"))).toEqual({error:"Unable to sign in. Check your email and password."});
  });
  it("validates next before building the Google callback", async () => {
    await signInWithGoogle("//attacker.example");
    expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({options:expect.objectContaining({redirectTo:expect.stringMatching(/next=%2F$/)})}));
  });
  it("does not expose OAuth provider diagnostics", async () => {
    signInWithOAuth.mockResolvedValue({data:null,error:{message:"private provider details"}});
    expect(await signInWithGoogle()).toEqual({error:"Unable to start Google sign-in. Please try again."});
  });
  it("clears the role cookie and redirects only after successful sign out", async () => {
    await expect(signOutAction()).resolves.toEqual({redirectTo:"/login"});expect(remove).toHaveBeenCalledWith("campus-dashboard-role");
  });
  it("returns shared accounts to the shared login", async () => {
    getUser.mockResolvedValue({data:{user:{app_metadata:{shared_dashboard_login:true}}}});
    await expect(signOutAction()).resolves.toEqual({redirectTo:"/super-admin-login"});
  });
  it("reports a failed sign out rather than pretending it succeeded", async () => {
    signOut.mockResolvedValue({error:{message:"private provider details"}});
    await expect(signOutAction()).rejects.toThrow("Unable to sign out. Please try again.");expect(remove).not.toHaveBeenCalled();
  });
});
