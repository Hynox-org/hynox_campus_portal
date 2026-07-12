import React from "react";
import { getCurrentUser } from "@/services/auth";
import { getProgramBySlug, listCourses, getAcademicLookups } from "@/services/academic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ArrowLeft, Home } from "lucide-react";
import ClientCourseList from "./client-course-list";

export const dynamic = "force-dynamic";

interface ProgramDetailPageProps {
  params: Promise<{
    programSlug: string;
  }>;
}

export default async function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const { programSlug } = await params;
  const userDetails = await getCurrentUser();
  if (!userDetails) return null;

  const { primaryRole, tenantId } = userDetails;
  
  // Resolve Program by slug
  const program = await getProgramBySlug(programSlug, tenantId || "");
  if (!program) {
    redirect("/academic");
  }

  const isStudent = primaryRole === "student";
  const courses = await listCourses(program.id, isStudent);

  // Fetch Lookups
  const lookups = await getAcademicLookups();

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-[#0F172A]">
      
      {/* Back link & Header */}
      <div className="mb-6">
        <Link
          href="/academic"
          className="flex items-center gap-1.5 text-xs text-[#2563EB] font-bold hover:underline mb-4"
        >
          <ArrowLeft size={14} /> Back to Programs
        </Link>
        
        <div className="border-b border-[#E2E8F0] pb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase font-bold text-[#475569] tracking-wider">Program</span>
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
            <span className="text-[10px] font-mono text-[#475569] select-all">{program.id}</span>
          </div>

          <h1 className="text-xl font-bold tracking-tight">{program.title}</h1>
          <p className="text-xs text-[#475569] mt-2 max-w-3xl leading-relaxed">
            {program.description || "No description provided for this academic pathway."}
          </p>
        </div>
      </div>

      {/* Interactive course listing and CRUD */}
      <ClientCourseList 
        program={program} 
        initialCourses={courses} 
        primaryRole={primaryRole} 
        lookups={lookups} 
      />

    </div>
  );
}
