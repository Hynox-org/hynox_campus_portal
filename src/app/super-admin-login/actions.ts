"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/services/auth";
import { isSharedLogin, SHARED_DASHBOARDS, SHARED_ROLE_COOKIE } from "@/lib/shared-login";

export async function sharedSignIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Unable to sign in. Check your email and password." };
  const cookieStore = await cookies();
  cookieStore.delete(SHARED_ROLE_COOKIE);
  if (!isSharedLogin(data.user)) {
    await supabase.auth.signOut();
    return { error: "This account does not have shared dashboard access." };
  }
  const current = await getCurrentUser();
  if (!current?.sharedLogin || !current.availableRoles?.length) {
    await supabase.auth.signOut();
    return { error: "This account is inactive or has no dashboard assignments." };
  }
  return { success: true };
}

export async function chooseSharedDashboard(formData: FormData) {
  const current = await getCurrentUser();
  const role = String(formData.get("role") || "");
  if (!current?.sharedLogin || !Object.hasOwn(SHARED_DASHBOARDS, role) || !current.availableRoles?.includes(role)) {
    throw new Error("This dashboard is not assigned to your account.");
  }
  if (["student", "institution_admin"].includes(role) && (!current.tenantId || current.institution?.status !== "active")) {
    throw new Error("An active institution must be assigned to this account.");
  }
  // This cookie chooses among assigned roles; the database validates it on every request.
  (await cookies()).set(SHARED_ROLE_COOKIE, `${current.authUser.id}:${role}`, {
    path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8,
  });
  redirect(SHARED_DASHBOARDS[role as keyof typeof SHARED_DASHBOARDS].path);
}
