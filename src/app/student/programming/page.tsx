import { getCurrentUser } from "@/services/auth";
import { getStudentAssignedChallenges } from "@/services/learning";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Terminal, Calendar, Code2, ShieldAlert, Award, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProgrammingChallengesPage() {
  const userDetails = await getCurrentUser();

  if (!userDetails || userDetails.primaryRole !== "student") {
    redirect("/login");
  }

  const studentId = userDetails.user.id;
  let challenges: any[] = [];
  try {
    challenges = await getStudentAssignedChallenges(studentId);
  } catch (error) {
    console.error("Failed to load assigned challenges:", error);
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
              href="/student"
              className="text-[#2563EB] hover:bg-[#2563EB]/5 px-3 py-1.5 rounded-lg border border-transparent hover:border-[#2563EB]/10 transition-all text-xs font-semibold"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 flex-1 w-full space-y-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">Programming Challenges</h1>
          <p className="text-xs text-[#475569] mt-1">
            Solve assigned coding exercises, validate solutions against test cases, and track your achievements.
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
            <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <Code2 size={15} className="text-[#2563EB]" /> Assigned Challenges ({challenges.length})
            </span>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {challenges.length > 0 ? (
              challenges.map((c) => {
                const diffColor =
                  c.difficulty === "easy"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                    : c.difficulty === "medium"
                    ? "bg-amber-50 text-amber-700 border-amber-200/50"
                    : "bg-red-50 text-red-700 border-red-200/50";

                const statusColor =
                  c.status === "completed"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : c.status === "submitted"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : c.status === "started"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : c.status === "failed"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-slate-50 text-slate-600 border-slate-200";

                const statusLabels: Record<string, string> = {
                  assigned: "Assigned",
                  started: "Started",
                  submitted: "Submitted",
                  completed: "Completed",
                  failed: "Failed"
                };

                return (
                  <div
                    key={c.challenge_id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-all"
                  >
                    <div className="space-y-2.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-xs text-[#0F172A] truncate">{c.title}</h2>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border capitalize ${diffColor}`}>
                          {c.difficulty}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#475569] line-clamp-1 max-w-2xl">{c.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[9px] text-[#475569] font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          Assigned: {c.assigned_date ? new Date(c.assigned_date).toLocaleDateString() : "N/A"}
                        </span>
                        {c.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            Due: {new Date(c.due_date).toLocaleDateString()}
                          </span>
                        )}
                        <span>Attempts: {c.attempts_count}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end shrink-0">
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border capitalize ${statusColor}`}>
                          {statusLabels[c.status] || c.status}
                        </span>
                        {c.score !== null && (
                          <span className="bg-[#2563EB]/5 text-[#2563EB] border border-[#2563EB]/15 px-2.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1">
                            <Award size={10} />
                            {c.score} / {c.max_score}
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/student/programming/${c.activity_id}`}
                        className="bg-white border border-[#E2E8F0] hover:border-[#2563EB]/20 hover:bg-[#2563EB]/5 text-[#0F172A] hover:text-[#2563EB] px-3.5 py-1.5 rounded-lg shadow-sm font-semibold text-[10px] transition-all flex items-center gap-1"
                      >
                        Open Workspace <ChevronRight size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="bg-slate-100 text-slate-400 p-3 rounded-full w-fit mx-auto">
                  <ShieldAlert size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-xs text-[#0F172A]">No Assigned Challenges</h3>
                  <p className="text-[10px] text-[#475569]">
                    You do not have any active programming challenges assigned to your cohort.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
