-- Migration: Rebuild Attendance System — restrict status values
-- Path: supabase/migrations/202607180001_rebuild_attendance_system.sql

ALTER TABLE delivery.attendance_records DROP CONSTRAINT attendance_records_status_check;
ALTER TABLE delivery.attendance_records ADD CONSTRAINT attendance_records_status_check CHECK (status IN ('present', 'absent', 'late'));
