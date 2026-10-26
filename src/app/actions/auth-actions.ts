"use server";

import { safeNextPath } from "@/lib/auth-redirect";
import { loginCredentials } from "@/lib/login-credentials";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { isSharedLogin, SHARED_ROLE_COOKIE } from "@/lib/shared-login";

export async function signInWithGoogle(redirectTo?: string) {
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Construct callback URL with optional next path parameters
  let callbackUrl = `${appUrl}/auth/callback`;
  if (redirectTo) {
    callbackUrl += `?next=${encodeURIComponent(safeNextPath(redirectTo))}`;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      skipBrowserRedirect: true
    },
  });

  if (error) {
    return { error: "Unable to start Google sign-in. Please try again." };
  }

  return { url: data?.url };
}

export async function signOutAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Unable to sign out. Please try again.");
  (await cookies()).delete(SHARED_ROLE_COOKIE);
  return { redirectTo: isSharedLogin(user) ? "/super-admin-login" as const : "/login" as const };
}

export async function signUpPublicUserAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  if (!email || !password || !fullName) {
    return { error: "All fields are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        onboarding_source: "public_signup",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signInWithPasswordAction(formData: FormData) {
  const credentials = loginCredentials(formData);
  if (!credentials) return { error: "Enter a valid email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return { error: "Unable to sign in. Check your email and password." };
  return { success: true };
}
