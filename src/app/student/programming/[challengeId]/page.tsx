import { getCurrentUser } from "@/services/auth";
import { getProgrammingChallengeDetails } from "@/services/learning";
import { redirect } from "next/navigation";
import WorkspaceConsole from "./workspace-console";
import Link from "next/link";
import { Terminal } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ challengeId: string }>;
}

export default async function ChallengeWorkspacePage({ params }: PageProps) {
  const { challengeId } = await params;
  const userDetails = await getCurrentUser();

  if (!userDetails || userDetails.primaryRole !== "student") {
    redirect("/login");
  }

  const studentId = userDetails.user.id;
  let workspaceData = null;

  try {
    // Note: The param variable 'challengeId' is actually the activityId mapped on route /student/programming/[challengeId]
    workspaceData = await getProgrammingChallengeDetails(challengeId, studentId);
  } catch (error) {
    console.error("Failed to load workspace data:", error);
    redirect("/student/programming");
  }

  if (!workspaceData || !workspaceData.challenge) {
    redirect("/student/programming");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-[#0F172A] font-sans antialiased">
      <header className="bg-white border-b border-[#E2E8F0] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/student" className="flex items-center gap-2.5">
            <div className="bg-[#2563EB]/10 text-[#2563EB] p-2 rounded-xl border border-[#2563EB]/20">
              <Terminal size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight">Hynox Campus Portal</span>
              <span className="text-[10px] text-[#475569] font-medium tracking-wide">STUDENT HUB</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/student/programming"
              className="text-[#475569] hover:text-[#0F172A] px-3.5 py-1.5 rounded-lg border border-[#E2E8F0] hover:border-slate-350 bg-white transition-all text-xs font-semibold"
            >
              Exit Workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
            {workspaceData.challenge.title || "Challenge Workspace"}
          </h1>
          <p className="text-xs text-[#475569] mt-1">
            Read guidelines, write and test code solution, and submit for evaluation.
          </p>
        </div>

        <WorkspaceConsole
          activityId={challengeId}
          studentId={studentId}
          initialData={workspaceData}
        />
      </main>
    </div>
  );
}
