-- Migration: Extend Academic Lesson Resources for Learning Content
-- Path: supabase/migrations/202606020007_extend_academic_lesson_resources.sql

-- 1. Create Lookup Table: academic.resource_types
CREATE TABLE academic.resource_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);

-- Seed academic.resource_types
INSERT INTO academic.resource_types (code, name, description) VALUES
('video', 'Video', 'Video learning resource (e.g. mp4, webm)'),
('pdf', 'PDF Document', 'PDF study materials or notes'),
('article', 'Article', 'Text-based article, blog, or documentation'),
('link', 'Web Link', 'General external hyperlink'),
('document', 'Document', 'Rich text document, spreadsheet, presentation, etc.'),
('download', 'Downloadable File', 'Downloadable software, code zip, datasets, etc.'),
('youtube', 'YouTube Video', 'YouTube embedded video link'),
('google_drive', 'Google Drive Resource', 'Google Drive shared resource folder or file'),
('external_resource', 'External Resource', 'Any other third party academic platform resource')
ON CONFLICT (code) DO NOTHING;

-- 2. Modify academic.lesson_resources
ALTER TABLE academic.lesson_resources DROP COLUMN IF EXISTS resource_type;
ALTER TABLE academic.lesson_resources DROP COLUMN IF EXISTS file_url;
ALTER TABLE academic.lesson_resources DROP COLUMN IF EXISTS external_url;

ALTER TABLE academic.lesson_resources 
ADD COLUMN resource_type_code TEXT NOT NULL REFERENCES academic.resource_types(code),
ADD COLUMN resource_url TEXT NOT NULL,
ADD COLUMN description TEXT,
ADD COLUMN thumbnail_url TEXT,
ADD COLUMN duration_seconds INTEGER,
ADD COLUMN file_size BIGINT,
ADD COLUMN mime_type TEXT,
ADD COLUMN is_preview BOOLEAN DEFAULT false,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Create Indexes
DROP INDEX IF EXISTS academic.idx_lesson_resources_lesson; -- Drop old index name if exists
CREATE INDEX idx_lesson_resources_lesson_id ON academic.lesson_resources(lesson_id);
CREATE INDEX idx_lesson_resources_type_code ON academic.lesson_resources(resource_type_code);
CREATE INDEX idx_lesson_resources_position ON academic.lesson_resources(position);
CREATE INDEX idx_lesson_resources_deleted_at ON academic.lesson_resources(deleted_at);

-- 4. Enable RLS & Set Permissions
ALTER TABLE academic.resource_types ENABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON academic.resource_types TO postgres, service_role, authenticated, anon;
CREATE POLICY select_resource_types ON academic.resource_types FOR SELECT TO authenticated USING (true);
