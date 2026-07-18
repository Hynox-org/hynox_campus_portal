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
    <div className="min-h-screen bg-[#0B0C0F] flex flex-col text-[#EDEFF5] font-sans">
      
      {/* Premium Header */}
      <header className="bg-[#131418] border-b border-[#23252C] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-95 transition-opacity">
              <div className="bg-[#6E79F4]/10 text-[#6E79F4] p-2 rounded-xl border border-[#6E79F4]/20">
                <GraduationCap size={18} />
              </div>
              <span className="font-bold text-sm tracking-tight">Hynox Curriculum</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-[#C2C6D1]">
              <Link href="/academic" className="px-3 py-1.5 rounded-lg hover:bg-[#16171D] hover:text-[#EDEFF5] transition-colors flex items-center gap-1.5">
                <BookOpen size={14} /> Programs Hub
              </Link>
              
              {primaryRole === "super_admin" && (
                <Link href="/admin" className="px-3 py-1.5 rounded-lg hover:bg-[#16171D] hover:text-[#EDEFF5] transition-colors flex items-center gap-1.5">
                  <Terminal size={14} /> Core Admin
                </Link>
              )}

              {primaryRole === "institution_admin" && (
                <Link href="/institution" className="px-3 py-1.5 rounded-lg hover:bg-[#16171D] hover:text-[#EDEFF5] transition-colors flex items-center gap-1.5">
                  <Home size={14} /> Admin Hub
                </Link>
              )}

              {(primaryRole === "teacher" || primaryRole === "trainer") && (
                <Link href="/teacher" className="px-3 py-1.5 rounded-lg hover:bg-[#16171D] hover:text-[#EDEFF5] transition-colors flex items-center gap-1.5">
                  <Home size={14} /> Teacher Portal
                </Link>
              )}

              {primaryRole === "student" && (
                <Link href="/student" className="px-3 py-1.5 rounded-lg hover:bg-[#16171D] hover:text-[#EDEFF5] transition-colors flex items-center gap-1.5">
                  <Home size={14} /> Student Dashboard
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <span className="hidden sm:inline text-[#C2C6D1] font-medium">
              Campus: <strong className="text-[#EDEFF5] font-bold">{tenantName}</strong>
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full font-bold border bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/20 text-[10px] capitalize">
              {primaryRole}
            </span>
            
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 w-full bg-[#0B0C0F]">
        {children}
      </main>

    </div>
  );
}
