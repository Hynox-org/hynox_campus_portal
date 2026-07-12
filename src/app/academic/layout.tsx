import React from "react";
import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import { Terminal, BookOpen, GraduationCap, Home } from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

interface AcademicLayoutProps {
  children: React.ReactNode;
}

export default async function AcademicLayout({ children }: AcademicLayoutProps) {
  const userDetails = await getCurrentUser();

  if (!userDetails) {
    redirect("/login");
  }

  const { authUser, primaryRole, institution } = userDetails;

  // Let's resolve tenant display details
  const tenantName = institution ? institution.name : "Public Cohort";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-[#0F172A] font-sans">
      
      {/* Premium Header */}
      <header className="bg-white border-b border-[#E2E8F0] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-95 transition-opacity">
              <div className="bg-[#2563EB]/10 text-[#2563EB] p-2 rounded-xl border border-[#2563EB]/20">
                <GraduationCap size={18} />
              </div>
              <span className="font-bold text-sm tracking-tight">Hynox Curriculum</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-[#475569]">
              <Link href="/academic" className="px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:text-[#0F172A] transition-colors flex items-center gap-1.5">
                <BookOpen size={14} /> Programs Hub
              </Link>
              
              {primaryRole === "super_admin" && (
                <Link href="/admin" className="px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:text-[#0F172A] transition-colors flex items-center gap-1.5">
                  <Terminal size={14} /> Core Admin
                </Link>
              )}

              {primaryRole === "institution_admin" && (
                <Link href="/institution" className="px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:text-[#0F172A] transition-colors flex items-center gap-1.5">
                  <Home size={14} /> Admin Hub
                </Link>
              )}

              {(primaryRole === "teacher" || primaryRole === "trainer") && (
                <Link href="/teacher" className="px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:text-[#0F172A] transition-colors flex items-center gap-1.5">
                  <Home size={14} /> Teacher Portal
                </Link>
              )}

              {primaryRole === "student" && (
                <Link href="/student" className="px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:text-[#0F172A] transition-colors flex items-center gap-1.5">
                  <Home size={14} /> Student Dashboard
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <span className="hidden sm:inline text-[#475569] font-medium">
              Campus: <strong className="text-[#0F172A] font-bold">{tenantName}</strong>
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full font-bold border bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20 text-[10px] capitalize">
              {primaryRole}
            </span>
            
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 w-full bg-[#F8FAFC]">
        {children}
      </main>

    </div>
  );
}
