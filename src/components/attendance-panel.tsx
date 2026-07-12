"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  getAttendanceSessionAction, 
  saveAttendanceAction, 
  getCohortAttendanceReportAction 
} from "@/app/actions/attendance-actions";
import { 
  Calendar, 
  Check, 
  AlertCircle, 
  Users, 
  Award, 
  Clock, 
  CheckCircle2, 
  Smile, 
  Megaphone,
  TrendingUp,
  ListTodo
} from "lucide-react";

interface AttendancePanelProps {
  cohorts: any[];
  students: any[];
  enrollments: any[];
  userRole: string;
}

export default function AttendancePanel({ cohorts, students, enrollments, userRole }: AttendancePanelProps) {
  const [selectedCohortId, setSelectedCohortId] = useState<string>(cohorts[0]?.id || "");
  const [activeTab, setActiveTab] = useState<"mark" | "analytics">("mark");
  
  // Local Today Date is static and locked (no date picker)
  const todayStr = useMemo(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().substring(0, 10);
  }, []);

  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [studentStatuses, setStudentStatuses] = useState<Record<string, "present" | "absent" | "late">>({});
  
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Enrolled students in the selected cohort
  const cohortStudents = useMemo(() => {
    if (!selectedCohortId) return [];
    const enrolledUserIds = enrollments
      .filter(e => e.cohort_id === selectedCohortId && e.status_code === "active" && !e.deleted_at)
      .map(e => e.user_id);
    return students.filter(s => enrolledUserIds.includes(s.id));
  }, [selectedCohortId, enrollments, students]);

  // Load report and current session details
  const loadData = async () => {
    if (!selectedCohortId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Load attendance report for analytics
      const repRes = await getCohortAttendanceReportAction(selectedCohortId);
      if (repRes.error) throw new Error(repRes.error);
      setReport(repRes.report);

      // 2. Load session for today
      const sessRes = await getAttendanceSessionAction(selectedCohortId, todayStr);
      if (sessRes.error) throw new Error(sessRes.error);

      if (sessRes.session) {
        setIsHoliday(sessRes.session.is_holiday);
        setHolidayName(sessRes.session.holiday_name || "");
      } else {
        setIsHoliday(false);
        setHolidayName("");
      }

      // 3. Load actual marking status records if exists
      if (sessRes.session) {
        // Fetch matching records
        const recordsResponse = await fetch(`/api/attendance/records?session_id=${sessRes.session.id}`);
        if (recordsResponse.ok) {
          const data = await recordsResponse.json();
          const statuses: Record<string, any> = {};
          data.forEach((r: any) => {
            statuses[r.student_id] = r.status;
          });
          setStudentStatuses(statuses);
        } else {
          setStudentStatuses({});
        }
      } else {
        // Auto default everyone to present if unmarked
        const initial: Record<string, any> = {};
        cohortStudents.forEach(s => {
          initial[s.id] = "present";
        });
        setStudentStatuses(initial);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load attendance details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCohortId]);

  const isSunday = new Date(todayStr).getDay() === 0;

  const handleSaveAttendance = async () => {
    setSaveLoading(true);
    setError(null);
    setSuccess(null);

    const recordsPayload = cohortStudents.map(student => ({
      student_id: student.id,
      status: studentStatuses[student.id] || "present"
    }));

    try {
      const res = await saveAttendanceAction(
        selectedCohortId,
        todayStr,
        isHoliday,
        holidayName,
        recordsPayload
      );

      if (res.error) throw new Error(res.error);
      
      setSuccess("Attendance saved successfully!");
      // Reload analytics report
      const repRes = await getCohortAttendanceReportAction(selectedCohortId);
      if (repRes.report) {
        setReport(repRes.report);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save attendance.");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-xs text-[#1d1d1f]">
      
      {/* Top Controls Bar */}
      <div className="bg-white border border-[#d2d2d7] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        {/* Cohort Select */}
        <div className="flex flex-col gap-1 w-full sm:w-64">
          <label className="font-bold text-[#86868b] uppercase tracking-wider text-[10px]">Select Cohort Batch</label>
          <select
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
            className="bg-white border border-[#d2d2d7] px-3 py-2 rounded-xl text-xs font-bold text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] shadow-xs w-full"
          >
            {cohorts.map(coh => (
              <option key={coh.id} value={coh.id}>{coh.name} ({coh.code})</option>
            ))}
          </select>
        </div>

        {/* View Toggle Buttons */}
        <div className="flex items-center bg-slate-100 p-1 border border-[#d2d2d7] rounded-xl self-stretch sm:self-auto gap-1">
          <button
            onClick={() => setActiveTab("mark")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-all ${
              activeTab === "mark"
                ? "bg-white text-[#0066cc] shadow-xs border border-[#d2d2d7]"
                : "text-[#86868b] hover:text-[#1d1d1f]"
            }`}
          >
            <ListTodo size={14} />
            Mark Today
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-all ${
              activeTab === "analytics"
                ? "bg-white text-[#0066cc] shadow-xs border border-[#d2d2d7]"
                : "text-[#86868b] hover:text-[#1d1d1f]"
            }`}
          >
            <TrendingUp size={14} />
            View Analytics
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] rounded-xl p-4 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-[#16A34A]/5 border border-[#16A34A]/20 text-[#16A34A] rounded-xl p-4 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {/* Main Panel Content */}
      {selectedCohortId && (
        <div className="space-y-6">
          {activeTab === "mark" ? (
            /* Tab 1: Mark Today's Sheet */
            <div className="bg-white border border-[#d2d2d7] rounded-xl overflow-hidden shadow-sm max-w-4xl mx-auto">
              <div className="bg-slate-50 px-6 py-4 border-b border-[#d2d2d7] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h4 className="font-bold text-xs text-[#1d1d1f] uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#0066cc]" /> 
                    Daily Attendance Sheet (Date: {todayStr})
                  </h4>
                  <p className="text-[10px] text-[#86868b] mt-0.5">
                    Record attendance statuses or mark this day as a holiday for the cohort.
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 font-bold cursor-pointer bg-slate-100 border border-[#d2d2d7] px-3 py-1.5 rounded-lg select-none hover:bg-slate-200 transition-colors text-[10px]">
                    <input
                      type="checkbox"
                      checked={isHoliday}
                      onChange={(e) => setIsHoliday(e.target.checked)}
                      className="rounded text-[#0066cc] focus:ring-[#0066cc]"
                    />
                    Govt Holiday
                  </label>
                </div>
              </div>

              {isSunday ? (
                <div className="p-8 text-center text-slate-500 font-semibold space-y-2">
                  <Smile size={32} className="mx-auto text-[#0066cc]" />
                  <p className="text-sm">Sunday (Weekly Leave)</p>
                  <p className="text-[10px] text-[#86868b] max-w-xs mx-auto">Sundays are automatically skipped and excluded from attendance statistics.</p>
                </div>
              ) : isHoliday ? (
                <div className="p-6 space-y-4">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3">
                    <Megaphone size={20} className="shrink-0" />
                    <div>
                      <span className="font-bold block">Government Holiday Active</span>
                      <span className="text-[10px]">This day is marked as a holiday. No student attendance calculations will take place.</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[10px] text-[#86868b] uppercase tracking-wider">Holiday Title / Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Independence Day, Christmas..."
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      className="bg-white border border-[#d2d2d7] px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0066cc] w-full"
                    />
                  </div>
                  <button
                    onClick={handleSaveAttendance}
                    disabled={saveLoading}
                    className="w-full bg-[#0066cc] text-white py-2 rounded-xl font-bold hover:bg-[#0066cc]/95 transition-all shadow-xs"
                  >
                    {saveLoading ? "Saving Holiday..." : "Confirm Government Holiday"}
                  </button>
                </div>
              ) : cohortStudents.length === 0 ? (
                <div className="p-8 text-center text-[#86868b] font-semibold bg-slate-50/10">
                  No active students enrolled in this cohort batch.
                </div>
              ) : (
                <div className="divide-y divide-[#d2d2d7]">
                  {cohortStudents.map((student) => {
                    const currentStatus = studentStatuses[student.id] || "present";
                    return (
                      <div key={student.id} className="px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-slate-50/20 transition-all">
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-[#1d1d1f] block">{student.full_name || "Enrolled Student"}</span>
                          <span className="text-[10px] text-[#86868b] block">{student.email}</span>
                        </div>

                        {/* Status Toggle Radio Pills (Excused Removed) */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {["present", "absent", "late"].map((statusOption) => (
                            <button
                              key={statusOption}
                              onClick={() => {
                                setStudentStatuses(prev => ({
                                  ...prev,
                                  [student.id]: statusOption as any
                                }));
                              }}
                              className={`px-3 py-1 rounded-lg font-bold capitalize text-[10px] border transition-all ${
                                currentStatus === statusOption
                                  ? statusOption === "present"
                                    ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30"
                                    : statusOption === "absent"
                                    ? "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30"
                                    : "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
                                  : "bg-white border-[#d2d2d7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-slate-50"
                              }`}
                            >
                              {statusOption}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className="px-6 py-4 bg-slate-50 border-t border-[#d2d2d7]">
                    <button
                      onClick={handleSaveAttendance}
                      disabled={saveLoading}
                      className="w-full bg-[#0066cc] text-white py-2.5 rounded-xl font-bold hover:bg-[#0066cc]/95 transition-all shadow-sm shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Check size={14} />
                      {saveLoading ? "Saving Attendance Sheet..." : "Save Today's Attendance Sheet"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Attendance History & Analytics (Dates selection disabled, overview list displays reports) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Standings list */}
              <div className="lg:col-span-2 bg-white border border-[#d2d2d7] rounded-xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-xs text-[#1d1d1f] uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={14} className="text-[#0066cc]" />
                  Students Standings & Analytics
                </h4>

                {loading ? (
                  <div className="text-center py-8 font-bold text-[#86868b] animate-pulse">Calculating data metrics...</div>
                ) : report ? (
                  <div className="divide-y divide-[#d2d2d7]">
                    {report.studentStats.map((stat: any) => {
                      const isUnderThreshold = stat.percentage < 70;
                      return (
                        <div key={stat.id} className="py-3 flex justify-between items-center hover:bg-slate-50/20 px-2 rounded-lg transition-all">
                          <div className="min-w-0 pr-2">
                            <span className="font-bold block text-sm text-[#1d1d1f]">{stat.name}</span>
                            <span className="text-[10px] text-[#86868b] block mt-0.5">
                              Present: {stat.present}d | Absent: {stat.absent}d | Late: {stat.late}d
                            </span>
                          </div>
                          
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border shrink-0 ${
                            isUnderThreshold 
                              ? "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20" 
                              : "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                          }`}>
                            {stat.percentage}%
                          </span>
                        </div>
                      );
                    })}
                    {report.studentStats.length === 0 && (
                      <div className="text-center py-6 text-slate-400">No student records enrolled.</div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">No logs mapped for this cohort batch.</div>
                )}
              </div>

              {/* Sessions Summary Metadata block */}
              <div className="bg-white border border-[#d2d2d7] rounded-xl p-4 shadow-sm space-y-4">
                <h4 className="font-bold text-xs text-[#1d1d1f] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-[#0066cc]" />
                  Active Days Log
                </h4>

                {report ? (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-slate-50 border border-[#d2d2d7] p-3 rounded-lg">
                        <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider block">Marked Days</span>
                        <span className="font-black text-sm text-[#1d1d1f] block mt-0.5">
                          {report.sessions.filter((s: any) => !s.is_holiday).length} Days
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-[#d2d2d7] p-3 rounded-lg">
                        <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider block">Govt Holidays</span>
                        <span className="font-black text-sm text-[#1d1d1f] block mt-0.5">
                          {report.sessions.filter((s: any) => s.is_holiday).length} Days
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {report.sessions.map((session: any) => (
                        <div key={session.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-[#d2d2d7]">
                          <div>
                            <span className="font-bold text-slate-700 block">{session.session_date}</span>
                            {session.is_holiday && (
                              <span className="text-[9px] text-[#F59E0B] font-semibold block">{session.holiday_name || "Govt Holiday"}</span>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            session.is_holiday ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "bg-[#16A34A]/10 text-[#16A34A]"
                          }`}>
                            {session.is_holiday ? "Holiday" : "Active"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400">No logs found.</div>
                )}
              </div>
              
            </div>
          )}
        </div>
      )}
      
    </div>
  );
}
