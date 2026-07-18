"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  X as XIcon,
  Clock3,
  Users,
  ChevronLeft,
  ChevronRight,
  Sun,
  CalendarOff,
  BarChart3,
  Table2,
  LayoutList,
  Loader2,
  Lock,
} from "lucide-react";
import {
  getAttendanceRegisterAction,
  bulkMarkAttendanceAction,
  setAttendanceStatusAction,
  markHolidayAction,
  unmarkHolidayAction,
} from "@/app/actions/attendance-actions";
import { useToast } from "@/components/toast";
import { SecondaryLoader } from "@/components/secondary-loader";
import type { AttendanceRegister as RegisterData, AttendanceStatus } from "@/services/attendance";

interface AttendanceRegisterProps {
  cohortId: string;
  cohortName: string;
  userRole: "super_admin" | "teacher" | "trainer";
}

const STATUS_CYCLE: AttendanceStatus[] = ["present", "absent", "late"];

function statusStyle(status: AttendanceStatus | undefined) {
  switch (status) {
    case "present":
      return { label: "P", classes: "bg-[#2FBF71]/15 text-[#2FBF71] border-[#2FBF71]/30" };
    case "absent":
      return { label: "A", classes: "bg-[#F0555D]/15 text-[#F0555D] border-[#F0555D]/30" };
    case "late":
      return { label: "L", classes: "bg-[#F5B04A]/15 text-[#F5B04A] border-[#F5B04A]/30" };
    default:
      return { label: "-", classes: "bg-[#16171D] text-[#5B606E] border-[#23252C]" };
  }
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
}

function todayStr() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().substring(0, 10);
}

export default function AttendanceRegister({ cohortId, cohortName, userRole }: AttendanceRegisterProps) {
  const { showSuccess, showError } = useToast();
  const [register, setRegister] = useState<RegisterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"day" | "sheet" | "stats">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "day" : "sheet"
  );
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [holidayNameDraft, setHolidayNameDraft] = useState("");
  const [showHolidayPrompt, setShowHolidayPrompt] = useState(false);

  // Teachers/trainers can only mark or edit attendance for the present day;
  // past and future dates are locked to a read-only view. Super Admins are exempt.
  const isRestrictedRole = userRole !== "super_admin";
  const isTodaySelected = selectedDate === todayStr();
  const canEditSelectedDate = !isRestrictedRole || isTodaySelected;

  const loadRegister = async () => {
    setLoading(true);
    const res = await getAttendanceRegisterAction(cohortId);
    if (res.error) {
      showError(res.error);
      setRegister(null);
    } else if (res.register) {
      setRegister(res.register);
      setSelectedDate((prev) => {
        if (prev && res.register!.dates.some((d) => d.date === prev)) return prev;
        const today = todayStr();
        const match = res.register!.dates.find((d) => d.date === today);
        return match ? match.date : res.register!.dates[res.register!.dates.length - 1]?.date || "";
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId]);

  const dateIndex = useMemo(() => {
    if (!register) return -1;
    return register.dates.findIndex((d) => d.date === selectedDate);
  }, [register, selectedDate]);

  const currentDateInfo = register && dateIndex >= 0 ? register.dates[dateIndex] : null;

  const stats = useMemo(() => {
    if (!register) return null;
    const workingDates = register.dates.filter((d) => !d.isHoliday);
    const workingDays = workingDates.length;
    const holidays = register.dates.length - workingDays;

    const students = register.students.map((student) => {
      const recs = register.records[student.id] || {};
      let present = 0;
      let absent = 0;
      let late = 0;
      for (const d of workingDates) {
        const s = recs[d.date];
        if (s === "present") present++;
        else if (s === "late") late++;
        else if (s === "absent") absent++;
      }
      const marked = present + absent + late;
      const percentage = marked > 0 ? Math.round(((present + late) / marked) * 1000) / 10 : 100;
      return { ...student, present, absent, late, percentage };
    });

    return { workingDays, holidays, totalDays: register.dates.length, students };
  }, [register]);

  const goToDate = (offset: number) => {
    if (!register) return;
    const nextIndex = dateIndex + offset;
    if (nextIndex < 0 || nextIndex >= register.dates.length) return;
    setSelectedDate(register.dates[nextIndex].date);
  };

  // Whether the given date is open for edits by the current user.
  const dateEditable = (dateStr: string) => !isRestrictedRole || dateStr === todayStr();

  const handleBulkMark = async (status: AttendanceStatus) => {
    if (!register || !currentDateInfo || currentDateInfo.isHoliday || !dateEditable(selectedDate)) return;
    setBusy(true);
    const studentIds = register.students.map((s) => s.id);
    const res = await bulkMarkAttendanceAction(cohortId, selectedDate, studentIds, status);
    if (res.error) {
      showError(res.error);
    } else {
      showSuccess(`Marked all students ${status} for ${formatDateLabel(selectedDate)}.`);
      await loadRegister();
    }
    setBusy(false);
  };

  const handleCycleStatus = async (studentId: string, dateStr: string) => {
    if (!register || !dateEditable(dateStr)) return;
    const dateInfo = register.dates.find((d) => d.date === dateStr);
    if (!dateInfo || dateInfo.isHoliday) return;
    const current = register.records[studentId]?.[dateStr];
    const currentIdx = current ? STATUS_CYCLE.indexOf(current) : -1;
    const next = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    await handleSetStatus(studentId, next, dateStr);
  };

  const handleSetStatus = async (studentId: string, status: AttendanceStatus, dateStr: string = selectedDate) => {
    if (!dateEditable(dateStr)) return;
    const dateInfo = register?.dates.find((d) => d.date === dateStr);
    if (!dateInfo || dateInfo.isHoliday) return;
    setRegister((prev) => {
      if (!prev) return prev;
      const records = { ...prev.records };
      records[studentId] = { ...(records[studentId] || {}), [dateStr]: status };
      return { ...prev, records };
    });
    const res = await setAttendanceStatusAction(cohortId, dateStr, studentId, status);
    if (res.error) {
      showError(res.error);
      await loadRegister();
    }
  };

  const handleToggleHoliday = async () => {
    if (!currentDateInfo || !dateEditable(selectedDate)) return;
    setBusy(true);
    if (currentDateInfo.isHoliday) {
      const res = await unmarkHolidayAction(cohortId, selectedDate);
      if (res.error) showError(res.error);
      else {
        showSuccess("Holiday removed. Day is now a working day.");
        await loadRegister();
      }
      setBusy(false);
    } else {
      setShowHolidayPrompt(true);
      setBusy(false);
    }
  };

  const confirmHoliday = async () => {
    setBusy(true);
    const res = await markHolidayAction(cohortId, selectedDate, holidayNameDraft || "Holiday");
    setBusy(false);
    setShowHolidayPrompt(false);
    setHolidayNameDraft("");
    if (res.error) showError(res.error);
    else {
      showSuccess("Marked as holiday.");
      await loadRegister();
    }
  };

  if (loading) {
    return <SecondaryLoader variant="spinner" message="Loading attendance register..." />;
  }

  if (!register) {
    return (
      <div className="bg-[#131418] border border-[#23252C] rounded-xl p-8 text-center text-[#C2C6D1] text-xs">
        Unable to load attendance register for this group.
      </div>
    );
  }

  if (register.students.length === 0) {
    return (
      <div className="bg-[#131418] border border-[#23252C] rounded-xl p-8 text-center text-[#C2C6D1] text-xs">
        No students are enrolled in <span className="font-semibold text-[#EDEFF5]">{cohortName}</span> yet.
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs text-[#EDEFF5]">
      {/* Header / summary */}
      <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#EDEFF5] flex items-center gap-1.5">
            <Calendar size={15} className="text-[#6E79F4]" /> {cohortName}
          </h3>
          <p className="text-[10px] text-[#C2C6D1] mt-1 font-mono">
            {register.cohort.start_date?.substring(0, 10)} → {register.cohort.end_date?.substring(0, 10)} · {register.students.length} student{register.students.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-1 bg-[#16171D] border border-[#23252C] rounded-lg p-1 self-start sm:self-auto">
          <button
            onClick={() => setView("day")}
            className={`px-2.5 py-1.5 rounded-md font-bold flex items-center gap-1 transition-all ${view === "day" ? "bg-[#6E79F4] text-white" : "text-[#C2C6D1] hover:text-[#EDEFF5]"}`}
          >
            <LayoutList size={13} /> Day
          </button>
          <button
            onClick={() => setView("sheet")}
            className={`px-2.5 py-1.5 rounded-md font-bold flex items-center gap-1 transition-all ${view === "sheet" ? "bg-[#6E79F4] text-white" : "text-[#C2C6D1] hover:text-[#EDEFF5]"}`}
          >
            <Table2 size={13} /> Sheet
          </button>
          <button
            onClick={() => setView("stats")}
            className={`px-2.5 py-1.5 rounded-md font-bold flex items-center gap-1 transition-all ${view === "stats" ? "bg-[#6E79F4] text-white" : "text-[#C2C6D1] hover:text-[#EDEFF5]"}`}
          >
            <BarChart3 size={13} /> Stats
          </button>
        </div>
      </div>

      {view === "day" && currentDateInfo && (
        <div className="space-y-3">
          {/* Date navigator */}
          <div className="bg-[#131418] border border-[#23252C] rounded-xl p-3 shadow-sm flex items-center justify-between gap-2">
            <button
              onClick={() => goToDate(-1)}
              disabled={dateIndex <= 0}
              className="p-2 rounded-lg border border-[#23252C] text-[#C2C6D1] hover:text-[#EDEFF5] hover:bg-[#16171D] disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex-1 text-center">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-[#16171D] border border-[#23252C] rounded-lg px-3 py-1.5 text-xs font-bold text-center focus:outline-none focus:border-[#6E79F4] max-w-full"
              >
                {register.dates.map((d) => (
                  <option key={d.date} value={d.date}>
                    {formatDateLabel(d.date)} {d.isHoliday ? "· Holiday" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => goToDate(1)}
              disabled={dateIndex === -1 || dateIndex >= register.dates.length - 1}
              className="p-2 rounded-lg border border-[#23252C] text-[#C2C6D1] hover:text-[#EDEFF5] hover:bg-[#16171D] disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {isRestrictedRole && !isTodaySelected && (
            <div className="bg-[#6E79F4]/5 border border-[#6E79F4]/20 rounded-xl p-3 shadow-sm flex items-center gap-2 text-[#6E79F4] font-semibold">
              <Lock size={14} className="shrink-0" />
              {dateIndex >= 0 && register.dates[dateIndex].date < todayStr()
                ? "This date is in the past and is locked. You can view it, but only Super Admin can make changes."
                : "This date is in the future. Attendance can only be marked on the day itself."}
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-[#131418] border border-[#23252C] rounded-xl p-3 shadow-sm flex flex-wrap gap-2">
            <button
              onClick={() => handleBulkMark("present")}
              disabled={busy || currentDateInfo.isHoliday || !canEditSelectedDate}
              className="flex-1 min-w-[130px] bg-[#2FBF71]/10 border border-[#2FBF71]/30 text-[#2FBF71] px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-[#2FBF71]/20 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <Check size={14} /> Mark All Present
            </button>
            <button
              onClick={() => handleBulkMark("absent")}
              disabled={busy || currentDateInfo.isHoliday || !canEditSelectedDate}
              className="flex-1 min-w-[130px] bg-[#F0555D]/10 border border-[#F0555D]/30 text-[#F0555D] px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-[#F0555D]/20 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <XIcon size={14} /> Mark All Absent
            </button>
            <button
              onClick={handleToggleHoliday}
              disabled={busy || !canEditSelectedDate}
              className={`px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all border disabled:opacity-40 disabled:pointer-events-none ${
                currentDateInfo.isHoliday
                  ? "bg-[#6E79F4]/10 border-[#6E79F4]/30 text-[#6E79F4] hover:bg-[#6E79F4]/20"
                  : "bg-[#16171D] border-[#23252C] text-[#C2C6D1] hover:text-[#EDEFF5]"
              }`}
            >
              <CalendarOff size={14} /> {currentDateInfo.isHoliday ? "Unmark Holiday" : "Mark Holiday"}
            </button>
          </div>

          {showHolidayPrompt && (
            <div className="bg-[#131418] border border-[#6E79F4]/40 rounded-xl p-4 shadow-sm space-y-3">
              <label className="block font-bold text-[#C2C6D1]">Holiday name (optional)</label>
              <input
                type="text"
                value={holidayNameDraft}
                onChange={(e) => setHolidayNameDraft(e.target.value)}
                placeholder="e.g. Independence Day"
                className="w-full bg-[#16171D] border border-[#23252C] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#6E79F4]"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowHolidayPrompt(false)}
                  className="border border-[#23252C] hover:bg-[#1A1C22] px-3 py-1.5 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmHoliday}
                  className="bg-[#6E79F4] text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-[#6E79F4]/90"
                >
                  Confirm Holiday
                </button>
              </div>
            </div>
          )}

          {/* Student list for the day */}
          {currentDateInfo.isHoliday ? (
            <div className="bg-[#131418] border border-[#23252C] rounded-xl p-8 text-center text-[#C2C6D1] flex flex-col items-center gap-2">
              <Sun size={22} className="text-[#F5B04A]" />
              <p className="font-semibold text-[#EDEFF5]">
                {currentDateInfo.holidayName || "Holiday"}
              </p>
              <p className="text-[10px]">No attendance is recorded on holidays.</p>
            </div>
          ) : (
            <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm divide-y divide-[#23252C]">
              {register.students.map((student) => {
                const status = register.records[student.id]?.[selectedDate];
                return (
                  <div key={student.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#EDEFF5] truncate">{student.full_name}</p>
                      <p className="text-[10px] text-[#C2C6D1] truncate">{student.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleSetStatus(student.id, "present")}
                        disabled={!canEditSelectedDate}
                        className={`w-9 h-9 rounded-lg border font-bold flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none ${
                          status === "present" ? "bg-[#2FBF71] text-white border-[#2FBF71]" : "bg-[#16171D] border-[#23252C] text-[#2FBF71] hover:bg-[#2FBF71]/10"
                        }`}
                        title="Present"
                      >
                        P
                      </button>
                      <button
                        onClick={() => handleSetStatus(student.id, "late")}
                        disabled={!canEditSelectedDate}
                        className={`w-9 h-9 rounded-lg border font-bold flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none ${
                          status === "late" ? "bg-[#F5B04A] text-white border-[#F5B04A]" : "bg-[#16171D] border-[#23252C] text-[#F5B04A] hover:bg-[#F5B04A]/10"
                        }`}
                        title="Late"
                      >
                        L
                      </button>
                      <button
                        onClick={() => handleSetStatus(student.id, "absent")}
                        disabled={!canEditSelectedDate}
                        className={`w-9 h-9 rounded-lg border font-bold flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none ${
                          status === "absent" ? "bg-[#F0555D] text-white border-[#F0555D]" : "bg-[#16171D] border-[#23252C] text-[#F0555D] hover:bg-[#F0555D]/10"
                        }`}
                        title="Absent"
                      >
                        A
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "sheet" && (
        <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[#16171D] border-b border-r border-[#23252C] px-4 py-2.5 text-left font-bold text-[#C2C6D1] min-w-[160px]">
                    Student
                  </th>
                  {register.dates.map((d) => (
                    <th
                      key={d.date}
                      className={`border-b border-[#23252C] px-1.5 py-2.5 text-center font-bold whitespace-nowrap min-w-[42px] cursor-pointer hover:bg-[#1A1C22] ${
                        d.isHoliday ? "text-[#F5B04A]" : d.date === selectedDate ? "text-[#6E79F4] bg-[#6E79F4]/5" : "text-[#C2C6D1]"
                      }`}
                      onClick={() => {
                        setSelectedDate(d.date);
                        setView("day");
                      }}
                      title={d.isHoliday ? d.holidayName || "Holiday" : formatDateLabel(d.date)}
                    >
                      <div>{d.date.substring(8, 10)}</div>
                      <div className="opacity-60">{d.date.substring(5, 7)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {register.students.map((student) => (
                  <tr key={student.id} className="hover:bg-[#16171D]/30">
                    <td className="sticky left-0 z-10 bg-[#131418] border-r border-b border-[#23252C] px-4 py-2 font-semibold text-[#EDEFF5] whitespace-nowrap">
                      {student.full_name}
                    </td>
                    {register.dates.map((d) => {
                      if (d.isHoliday) {
                        return (
                          <td key={d.date} className="border-b border-[#23252C] px-1.5 py-2 text-center bg-[#F5B04A]/5 text-[#F5B04A]">
                            H
                          </td>
                        );
                      }
                      const status = register.records[student.id]?.[d.date];
                      const s = statusStyle(status);
                      const editable = dateEditable(d.date);
                      return (
                        <td key={d.date} className="border-b border-[#23252C] px-1.5 py-2 text-center">
                          <button
                            onClick={() => handleCycleStatus(student.id, d.date)}
                            disabled={!editable}
                            title={editable ? undefined : "Locked — only Super Admin can edit this date"}
                            className={`w-6 h-6 rounded border font-bold ${s.classes} transition-opacity ${
                              editable ? "hover:opacity-80" : "opacity-60 cursor-not-allowed"
                            }`}
                          >
                            {s.label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "stats" && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">Working Days</p>
              <p className="text-xl font-bold text-[#EDEFF5] mt-1">{stats.workingDays}</p>
            </div>
            <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">Holidays</p>
              <p className="text-xl font-bold text-[#F5B04A] mt-1">{stats.holidays}</p>
            </div>
            <div className="bg-[#131418] border border-[#23252C] rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-[#C2C6D1] uppercase tracking-wider">Total Span</p>
              <p className="text-xl font-bold text-[#EDEFF5] mt-1">{stats.totalDays}</p>
            </div>
          </div>

          <div className="bg-[#131418] border border-[#23252C] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#16171D] border-b border-[#23252C] font-bold text-[#C2C6D1]">
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5 text-center">Present</th>
                    <th className="px-4 py-2.5 text-center">Late</th>
                    <th className="px-4 py-2.5 text-center">Absent</th>
                    <th className="px-4 py-2.5 text-right">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#23252C]">
                  {stats.students.map((s) => (
                    <tr key={s.id} className="hover:bg-[#16171D]/30">
                      <td className="px-4 py-2.5 font-semibold text-[#EDEFF5]">{s.full_name}</td>
                      <td className="px-4 py-2.5 text-center text-[#2FBF71] font-bold">{s.present}</td>
                      <td className="px-4 py-2.5 text-center text-[#F5B04A] font-bold">{s.late}</td>
                      <td className="px-4 py-2.5 text-center text-[#F0555D] font-bold">{s.absent}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`font-bold ${
                            s.percentage >= 75 ? "text-[#2FBF71]" : s.percentage >= 50 ? "text-[#F5B04A]" : "text-[#F0555D]"
                          }`}
                        >
                          {s.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {busy && (
        <div className="fixed bottom-4 right-4 bg-[#131418] border border-[#23252C] rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-2 text-xs font-semibold z-50">
          <Loader2 size={14} className="animate-spin text-[#6E79F4]" /> Saving...
        </div>
      )}
    </div>
  );
}
