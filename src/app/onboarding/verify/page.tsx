import { verifyInvitation } from "@/services/onboarding";
import { signInWithGoogle } from "@/app/actions/auth-actions";
import { getCurrentUser } from "@/services/auth";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Terminal, ShieldCheck, AlertTriangle } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    token?: string;
    email?: string;
  }>;
}

export default async function OnboardingVerifyPage({ searchParams }: PageProps) {
  const { token, email } = await searchParams;

  // 1. Check if the user is already authenticated
  const currentUser = await getCurrentUser();
  if (currentUser && currentUser.user) {
    const dashboardRoutes: Record<string, string> = {
      super_admin: "/admin",
      institution_admin: "/institution",
      teacher: "/teacher",
      trainer: "/teacher",
      student: "/student",
    };
    const dest = dashboardRoutes[currentUser.primaryRole] || "/public";
    redirect(dest);
  }

  // 2. Check if the email parameter is already linked in core.users
  if (email) {
    const supabase = await createClient();
    const { data: dbUser } = await supabase
      .schema("core")
      .from("users")
      .select("auth_user_id")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (dbUser && dbUser.auth_user_id) {
      redirect("/login?message=AlreadyActivated");
    }
  }

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-[#0F172A]">
        <div className="max-w-md w-full bg-white border border-[#E2E8F0] rounded-xl p-8 shadow-sm text-center">
          <AlertTriangle className="text-[#DC2626] mx-auto mb-4" size={40} />
          <h2 className="text-lg font-bold mb-2">Invalid Onboarding Link</h2>
          <p className="text-sm text-[#475569]">
            The onboarding link is missing a valid token or email address. Please request a new invite link from your administrator.
          </p>
        </div>
      </div>
    );
  }

  const result = await verifyInvitation(token, email);

  if (!result.valid || !result.invitation) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-[#0F172A]">
        <div className="max-w-md w-full bg-white border border-[#E2E8F0] rounded-xl p-8 shadow-sm text-center">
          <AlertTriangle className="text-[#DC2626] mx-auto mb-4" size={40} />
          <h2 className="text-lg font-bold mb-2">Verification Failed</h2>
          <p className="text-sm text-[#475569] mb-4">{result.error}</p>
          <p className="text-xs text-[#475569]">
            Invitations expire in 7 days. If your invitation has expired or has been revoked, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const { fullName, institutionName, invitationType } = result.invitation;

  // Map invitation type to human-readable role name
  const roleNameMap: Record<string, string> = {
    student_onboarding: "Student",
    trainer_onboarding: "Teacher / Instructor",
    institution_admin_invite: "Institution Administrator",
    mentor_invite: "Mentor",
    super_admin_invite: "Super Administrator",
  };
  const roleLabel = roleNameMap[invitationType] || "Member";

  async function handleAccept() {
    "use server";
    // Trigger Google Auth login, which automatically links the auth user account
    // to pre-provisioned core.users on callback via the database trigger.
    const res = await signInWithGoogle("/");
    if (res.url) {
      redirect(res.url);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-[#0F172A]">
      <div className="max-w-md w-full bg-white border border-[#E2E8F0] rounded-xl p-8 shadow-md relative">
        <div className="absolute -top-3 right-6 bg-[#2563EB] text-white text-[9px] font-bold font-mono tracking-wider px-2 py-1 rounded shadow-sm flex items-center gap-1">
          <ShieldCheck size={10} />
          VERIFIED PORTAL
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#2563EB]/15 text-[#2563EB] p-2.5 rounded-xl border border-[#2563EB]/20">
            <Terminal size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-bold leading-tight">Claim Invitation</h3>
            <p className="text-[11px] text-[#475569] mt-0.5">Hynox Campus Onboarding</p>
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 mb-6 space-y-3.5 text-xs text-[#0F172A]">
          <div>
            <span className="text-[10px] font-bold text-[#475569] block uppercase tracking-wide">
              Full Name
            </span>
            <span className="font-semibold text-sm">{fullName}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#475569] block uppercase tracking-wide">
              Email Address
            </span>
            <span className="font-semibold">{email}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#475569] block uppercase tracking-wide">
              Institution / Organization
            </span>
            <span className="font-semibold">{institutionName}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#475569] block uppercase tracking-wide">
              Assigned Role
            </span>
            <span className="inline-flex px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] font-bold mt-1 text-[10px]">
              {roleLabel}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#475569] mb-5 text-center leading-relaxed">
          Accept this invitation to initialize your account. You will be redirected to log in with your Google account to secure your credentials.
        </p>

        <form action={handleAccept}>
          <button
            type="submit"
            className="w-full bg-[#2563EB] text-white text-xs font-semibold py-3 rounded-lg shadow-sm hover:bg-[#2563EB]/95 transition-all duration-200"
          >
            Accept Invitation & Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
