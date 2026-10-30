export const ATTENDANCE_TIME_ZONE = "Asia/Kolkata";
export function attendanceToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ATTENDANCE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function attendancePercentage(present: number, late: number, absent: number) {
  const marked = present + late + absent;
  return marked ? Math.round(((present + late) / marked) * 1000) / 10 : 0;
}
export function validateAttendanceDate(date: string) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error("Invalid attendance date.");
}

import type { AttendanceRegister, AttendanceStats } from '@/services/attendance';
export function summarizeAttendance(register: AttendanceRegister): AttendanceStats {
  const elapsed = register.dates.filter(d => d.date <= attendanceToday());
  const working = elapsed.filter(d => !d.isHoliday);
  return { workingDays: working.length, holidays: elapsed.length - working.length, totalDays: elapsed.length,
    students: register.students.map(student => {
      let present = 0, absent = 0, late = 0;
      const dates = working.filter(d => !student.enrolled_date || d.date >= student.enrolled_date);
      for (const d of dates) {
        const status = register.records[student.id]?.[d.date];
        if (status === "present") present++;
        else if (status === "late") late++;
        else if (status === "absent") absent++;
      }
      return { studentId: student.id, name: student.full_name, email: student.email, present, absent, late, workingDays: dates.length, percentage: attendancePercentage(present, late, absent) };
    }) };
}

