-- Migration: Add max_attempts limit to programming challenges
-- Path: supabase/migrations/202607190001_add_max_attempts_to_programming_challenges.sql

ALTER TABLE learning.programming_challenges
  ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
