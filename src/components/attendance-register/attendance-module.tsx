"use client";

import React, { useState } from "react";
import { Building, Users } from "lucide-react";
import { useDeliveryData } from "@/hooks/use-delivery";
import { CustomSelect } from "@/components/custom-select";
import { SecondaryLoader } from "@/components/secondary-loader";
import type { Institution } from "@/types/campus";
import AttendanceRegister from "./attendance-register";

interface AttendanceModuleProps {
  institutions: Institution[];
  userRole: "super_admin" | "teacher" | "trainer";
}

export default function AttendanceModule({ institutions, userRole }: AttendanceModuleProps) {
  const [institutionChoice, setSelectedInstId] = useState("");
  const [cohortChoice, setSelectedCohortId] = useState("");
  const selectedInstId = institutions.some(i => i.id === institutionChoice) ? institutionChoice : institutions[0]?.id ?? "";
  const { data: deliveryData, isLoading, error, refetch } = useDeliveryData(selectedInstId);
  const cohorts = deliveryData?.cohorts || [];
  const selectedCohortId = cohorts.some(c => c.id === cohortChoice) ? cohortChoice : cohorts[0]?.id ?? "";
  const selectedCohort = cohorts.find(c => c.id === selectedCohortId);
  return (
    <div className="space-y-6 text-xs text-[#EDEFF5]">
      <div className="bg-[#131418] border border-[#23252C] p-6 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5 text-[#C2C6D1] flex items-center gap-1.5">
            <Users size={15} /> Attendance Register
          </h3>
          <p className="text-[10px] text-[#C2C6D1] leading-relaxed">
            Mark and review daily attendance for each group&apos;s enrolled roster.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {institutions.length > 1 && (
            <div className="w-full sm:w-56">
              <label className="block text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building size={11} /> Institution
              </label>
              <CustomSelect
                options={institutions.map((inst) => ({ id: inst.id, name: inst.name, code: inst.institution_code }))}
                value={selectedInstId}
                onChange={(value) => {
                  setSelectedInstId(value);
                  setSelectedCohortId("");
                }}
                required
              />
            </div>
          )}

          <div className="w-full sm:w-64">
            <label className="block text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider mb-1">Group</label>
            <CustomSelect
              options={cohorts.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
              value={selectedCohortId}
              onChange={setSelectedCohortId}
              placeholder="-- Select Group --"
              required
            />
          </div>
        </div>
      </div>

      {error ? <div role="alert">{error.message}<button className="ml-3 underline" onClick={() => void refetch()}>Retry</button></div> : isLoading && !cohorts.length ? (
        <SecondaryLoader variant="spinner" message="Loading groups..." />
      ) : cohorts.length === 0 ? (
        <div className="bg-[#131418] border border-[#23252C] rounded-xl p-8 text-center text-[#C2C6D1] text-xs">
          No groups found for this institution. Create a group in the Groups module first.
        </div>
      ) : selectedCohort ? (
        !selectedCohort.start_date || !selectedCohort.end_date ? (
          <div className="bg-[#131418] border border-[#23252C] rounded-xl p-8 text-center text-[#C2C6D1] text-xs">
            <span className="font-semibold text-[#EDEFF5]">{selectedCohort.name}</span> does not have a start and end
            date configured. Set a date range for this group in the Groups module to generate its attendance register.
          </div>
        ) : (
          <AttendanceRegister
            key={selectedCohort.id}
            cohortId={selectedCohort.id}
            cohortName={`${selectedCohort.name} (${selectedCohort.code})`}
            userRole={userRole}
          />
        )
      ) : null}
    </div>
  );
}
