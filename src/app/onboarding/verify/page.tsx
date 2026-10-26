import { verifyInvitation } from "@/services/onboarding";
import { signInWithGoogle } from "@/app/actions/auth-actions";
import { getCurrentUser } from "@/services/auth";
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

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-[#0B0C0F] flex flex-col items-center justify-center p-6 text-[#EDEFF5]">
        <div className="max-w-md w-full bg-[#131418] border border-[#23252C] rounded-xl p-8 shadow-sm text-center">
          <AlertTriangle className="text-[#F0555D] mx-auto mb-4" size={40} />
          <h2 className="text-lg font-bold mb-2">Invalid Onboarding Link</h2>
          <p className="text-sm text-[#C2C6D1]">
            The onboarding link is missing a valid token or email address. Please request a new invite link from your administrator.
          </p>
        </div>
      </div>
    );
  }

  const result = await verifyInvitation(token, email);

  if (!result.valid || !result.invitation) {
    return (
      <div className="min-h-screen bg-[#0B0C0F] flex flex-col items-center justify-center p-6 text-[#EDEFF5]">
        <div className="max-w-md w-full bg-[#131418] border border-[#23252C] rounded-xl p-8 shadow-sm text-center">
          <AlertTriangle className="text-[#F0555D] mx-auto mb-4" size={40} />
          <h2 className="text-lg font-bold mb-2">Verification Failed</h2>
          <p className="text-sm text-[#C2C6D1] mb-4">{result.error}</p>
          <p className="text-xs text-[#C2C6D1]">
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
    <div className="min-h-screen bg-[#0B0C0F] flex flex-col items-center justify-center p-6 text-[#EDEFF5]">
      <div className="max-w-md w-full bg-[#131418] border border-[#23252C] rounded-xl p-8 shadow-md relative">
        <div className="absolute -top-3 right-6 bg-[#6E79F4] text-white text-[9px] font-bold font-mono tracking-wider px-2 py-1 rounded shadow-sm flex items-center gap-1">
          <ShieldCheck size={10} />
          VERIFIED PORTAL
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-[#6E79F4]/15 text-[#6E79F4] p-2.5 rounded-xl border border-[#6E79F4]/20">
            <Terminal size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-bold leading-tight">Claim Invitation</h3>
            <p className="text-[11px] text-[#C2C6D1] mt-0.5">Hynox Campus Onboarding</p>
          </div>
        </div>

        <div className="bg-[#0B0C0F] border border-[#23252C] rounded-xl p-5 mb-6 space-y-3.5 text-xs text-[#EDEFF5]">
          <div>
            <span className="text-[10px] font-bold text-[#C2C6D1] block uppercase tracking-wide">
              Full Name
            </span>
            <span className="font-semibold text-sm">{fullName}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#C2C6D1] block uppercase tracking-wide">
              Email Address
            </span>
            <span className="font-semibold">{email}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#C2C6D1] block uppercase tracking-wide">
              Institution / Organization
            </span>
            <span className="font-semibold">{institutionName}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#C2C6D1] block uppercase tracking-wide">
              Assigned Role
            </span>
            <span className="inline-flex px-2 py-0.5 rounded bg-[#6E79F4]/10 text-[#6E79F4] font-bold mt-1 text-[10px]">
              {roleLabel}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#C2C6D1] mb-5 text-center leading-relaxed">
          Accept this invitation to initialize your account. You will be redirected to log in with your Google account to secure your credentials.
        </p>

        <form action={handleAccept}>
          <button
            type="submit"
            className="w-full bg-[#6E79F4] text-white text-xs font-semibold py-3 rounded-lg shadow-sm hover:bg-[#6E79F4]/95 transition-all duration-200"
          >
            Accept Invitation & Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
