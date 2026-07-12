import React from "react";
import { getCurrentUser } from "@/services/auth";
import { listPrograms, getAcademicLookups } from "@/services/academic";
import Link from "next/link";
import { Plus, Folder, ArrowRight, Eye, CheckCircle, Edit, Trash2 } from "lucide-react";
import ClientProgramList from "./client-program-list";

export const dynamic = "force-dynamic";

export default async function AcademicProgramsPage() {
  const userDetails = await getCurrentUser();
  if (!userDetails) return null;

  const { primaryRole, tenantId } = userDetails;
  
  const programs = await listPrograms(tenantId || "", primaryRole);

  // Fetch lookup lists for statuses and visibility
  const lookups = await getAcademicLookups();

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-[#0F172A]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-6 mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Academic Programs</h1>
          <p className="text-xs text-[#475569] mt-1">
            Browse and manage top-level curriculum categories and career pathways.
          </p>
        </div>
      </div>

      {/* Render Client component for list and CRUD dialogs */}
      <ClientProgramList 
        initialPrograms={programs} 
        primaryRole={primaryRole} 
        lookups={lookups} 
      />
    </div>
  );
}
