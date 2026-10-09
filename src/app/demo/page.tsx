import { ArrowRight, GraduationCap, School, ShieldCheck, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default function DemoPage() {
  if (!isDemoMode()) redirect("/login");

  const dashboards = [
    { href: "/admin", title: "Hynox Admin", description: "Manage institutions, courses, users, and learning activities.", icon: ShieldCheck },
    { href: "/institution", title: "Institution Admin", description: "Manage your campus, cohorts, enrollments, and student progress.", icon: School },
    { href: "/teacher", title: "Teacher", description: "Manage assigned classes, attendance, and review student work.", icon: Users },
    { href: "/student", title: "Student", description: "Explore your courses, lessons, quizzes, projects, and coding challenges.", icon: GraduationCap },
  ];

  return (
    <main className="min-h-screen bg-[#0B0C0F] text-[#EDEFF5] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <span className="inline-block text-xs font-semibold text-[#6E79F4] bg-[#6E79F4]/10 border border-[#6E79F4]/20 rounded-full px-4 py-1.5 mb-5">HYNOX CAMPUS DEMO</span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Choose your dashboard</h1>
          <p className="text-[#A3A9B6] mt-3">Explore Hynox Campus as any role. No sign-in required.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {dashboards.map(({ href, title, description, icon: Icon }) => (
            <a key={href} href={href} className="group rounded-2xl border border-[#23252C] bg-[#131418] p-6 hover:border-[#6E79F4] transition-colors focus-visible:outline-2 focus-visible:outline-[#6E79F4]">
              <Icon className="text-[#6E79F4] mb-5" size={28} />
              <h2 className="text-lg font-semibold flex items-center justify-between">{title}<ArrowRight size={18} className="text-[#A3A9B6] group-hover:text-[#6E79F4]" /></h2>
              <p className="mt-2 text-sm text-[#A3A9B6] leading-relaxed">{description}</p>
            </a>
          ))}
        </div>
        <p className="text-center text-xs text-[#A3A9B6] mt-8">Each role uses a shared demo profile. Changes are saved to the connected campus.</p>
      </div>
    </main>
  );
}
