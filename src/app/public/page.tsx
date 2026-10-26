import { getCurrentUser } from "@/services/auth";
import SignOutButton from "@/components/sign-out-button";
import { redirect } from "next/navigation";
import { Terminal, Info, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicPage() {
  const userDetails = await getCurrentUser();

  // Also allow mentors to share this dashboard placeholder
  if (
    !userDetails ||
    (userDetails.primaryRole !== "public" && userDetails.primaryRole !== "mentor")
  ) {
    redirect("/login");
  }

  const { authUser, primaryRole } = userDetails;

  return (
    <div className="min-h-screen bg-[#0B0C0F] flex flex-col text-[#EDEFF5] font-sans">
      <header className="bg-[#131418] border-b border-[#23252C] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#6E79F4]/10 text-[#6E79F4] p-2 rounded-xl border border-[#6E79F4]/20">
              <Terminal size={18} />
            </div>
            <span className="font-bold text-sm tracking-tight">Hynox Campus Portal</span>
          </div>

          <SignOutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full space-y-6">
        <div className="bg-[#131418] border border-[#23252C] rounded-xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#3A3F4B]/10 text-[#C2C6D1] p-2.5 rounded-xl border border-[#9BA1AE]/20">
              <Info size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold">Public Account Hub</h2>
              <p className="text-xs text-[#C2C6D1]">Awaiting invitation or onboarding tokens</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-[#0B0C0F] border border-[#23252C] rounded-xl p-5 mb-6">
            <div>
              <span className="text-[10px] font-bold text-[#C2C6D1] block uppercase tracking-wide">User Email</span>
              <span className="font-semibold">{authUser.email}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#C2C6D1] block uppercase tracking-wide">Resolved RBAC Role</span>
              <span className="font-semibold inline-flex px-2 py-0.5 rounded bg-[#3A3F4B]/15 text-[#C2C6D1] font-bold mt-1 text-[10px]">
                {primaryRole}
              </span>
            </div>
          </div>

          <div className="bg-[#F5B04A]/5 border border-[#F5B04A]/20 text-[#EDEFF5] rounded-xl p-5 text-xs flex items-start gap-2.5 leading-relaxed">
            <ShieldAlert className="text-[#F5B04A] shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-bold block mb-1">Onboarding Required</span>
              <span>
                Your email is registered with a `public` account role. You do not have permissions to access private campus classrooms. 
                If you have been issued an activation token (e.g. `HYN-XXX-XX`) by your professor or department admin, please claim it 
                in the login panel to activate your student/teacher dashboard.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
