-- Migration: Drop unique constraint on quiz_answers to support multiple choice answers
-- Path: supabase/migrations/202606060001_drop_quiz_answers_unique_constraint.sql

ALTER TABLE learning.quiz_answers DROP CONSTRAINT IF EXISTS uidx_quiz_answers_attempt_question;
