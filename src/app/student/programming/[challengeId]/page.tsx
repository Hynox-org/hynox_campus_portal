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
    <div className="min-h-screen bg-[#0B0C0F] flex flex-col text-[#EDEFF5] font-sans antialiased">
      <header className="bg-[#131418] border-b border-[#23252C] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/student" className="flex items-center gap-2.5">
            <div className="bg-[#6E79F4]/10 text-[#6E79F4] p-2 rounded-xl border border-[#6E79F4]/20">
              <Terminal size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight">Hynox Campus Portal</span>
              <span className="text-[10px] text-[#C2C6D1] font-medium tracking-wide">STUDENT HUB</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/student/programming"
              className="text-[#C2C6D1] hover:text-[#EDEFF5] px-3.5 py-1.5 rounded-lg border border-[#23252C] hover:border-[#2E313A] bg-[#131418] transition-all text-xs font-semibold"
            >
              Exit Workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#EDEFF5]">
            {workspaceData.challenge.title || "Challenge Workspace"}
          </h1>
          <p className="text-xs text-[#C2C6D1] mt-1">
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
