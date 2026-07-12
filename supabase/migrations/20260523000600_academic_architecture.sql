-- Migration: Phase 2 Academic Architecture (Normalized)
-- Path: supabase/migrations/20260523000600_academic_architecture.sql

-- 1. Reset Schema
DROP SCHEMA IF EXISTS academic CASCADE;
CREATE SCHEMA academic;

-- 2. Create Lookup Tables
CREATE TABLE academic.course_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE academic.lesson_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE academic.statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE academic.visibility_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Lookup Tables
INSERT INTO academic.course_types (code, description) VALUES
('theory', 'Theory course'),
('practical', 'Practical or lab course'),
('hybrid', 'Hybrid course'),
('project', 'Project-based course')
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic.lesson_types (code, description) VALUES
('video', 'Video lecture'),
('text', 'Text-based content'),
('pdf', 'PDF document resource'),
('assignment', 'Assignment lesson')
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic.statuses (code, description) VALUES
('draft', 'Draft status'),
('active', 'Active and published'),
('archived', 'Archived/deprecated')
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic.visibility_types (code, description) VALUES
('public', 'Publicly accessible'),
('private', 'Private to instructor/admin'),
('tenant_only', 'Visible to tenant users only')
ON CONFLICT (code) DO NOTHING;

-- Create helper functions for default values
CREATE OR REPLACE FUNCTION academic.get_status_id_by_code(p_code TEXT)
RETURNS UUID AS $$
    SELECT id FROM academic.statuses WHERE code = p_code;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION academic.get_visibility_type_id_by_code(p_code TEXT)
RETURNS UUID AS $$
    SELECT id FROM academic.visibility_types WHERE code = p_code;
$$ LANGUAGE sql STABLE;

-- 3. Create Hierarchical Tables
CREATE TABLE academic.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    status_id UUID NOT NULL REFERENCES academic.statuses(id) DEFAULT academic.get_status_id_by_code('draft'),
    visibility_type_id UUID NOT NULL REFERENCES academic.visibility_types(id) DEFAULT academic.get_visibility_type_id_by_code('private'),
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE academic.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES academic.programs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    course_type_id UUID REFERENCES academic.course_types(id) ON DELETE SET NULL,
    status_id UUID NOT NULL REFERENCES academic.statuses(id) DEFAULT academic.get_status_id_by_code('draft'),
    visibility_type_id UUID NOT NULL REFERENCES academic.visibility_types(id) DEFAULT academic.get_visibility_type_id_by_code('private'),
    enrollment_mode TEXT NOT NULL DEFAULT 'open' CHECK (enrollment_mode IN ('open', 'approval', 'private', 'institution_only')),
    duration_minutes INTEGER,
    thumbnail_path TEXT,
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE academic.course_instructors (
    course_id UUID NOT NULL REFERENCES academic.courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    instructor_role TEXT NOT NULL DEFAULT 'primary',
    tenant_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (course_id, user_id)
);

CREATE TABLE academic.modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES academic.courses(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 1,
    status_id UUID NOT NULL REFERENCES academic.statuses(id) DEFAULT academic.get_status_id_by_code('active'),
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE academic.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES academic.modules(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lesson_type_id UUID REFERENCES academic.lesson_types(id) ON DELETE SET NULL,
    content_json JSONB,
    video_url TEXT,
    duration INTEGER,
    position INTEGER NOT NULL DEFAULT 1,
    is_preview BOOLEAN NOT NULL DEFAULT false,
    status_id UUID NOT NULL REFERENCES academic.statuses(id) DEFAULT academic.get_status_id_by_code('active'),
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE academic.lesson_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES academic.lessons(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT,
    external_url TEXT,
    position INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 4. Create Indexes
CREATE UNIQUE INDEX uidx_programs_tenant_slug ON academic.programs(tenant_id, slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uidx_courses_tenant_slug ON academic.courses(tenant_id, slug) WHERE deleted_at IS NULL;

CREATE INDEX idx_programs_tenant ON academic.programs(tenant_id);
CREATE INDEX idx_courses_tenant ON academic.courses(tenant_id);
CREATE INDEX idx_course_instructors_user ON academic.course_instructors(user_id);
CREATE INDEX idx_modules_course ON academic.modules(course_id);
CREATE INDEX idx_lessons_module ON academic.lessons(module_id);
CREATE INDEX idx_lesson_resources_lesson ON academic.lesson_resources(lesson_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE academic.course_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic.lesson_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic.visibility_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE academic.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic.course_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic.lesson_resources ENABLE ROW LEVEL SECURITY;

-- 6. Define Draft RLS Policies (tenant-aware access)
-- Grant usage on academic schema to postgres, authenticated, service_role
GRANT USAGE ON SCHEMA academic TO postgres, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA academic TO postgres, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA academic TO postgres, authenticated, service_role;

-- Course/Lesson types are read-only to authenticated users
CREATE POLICY select_course_types ON academic.course_types FOR SELECT TO authenticated USING (true);
CREATE POLICY select_lesson_types ON academic.lesson_types FOR SELECT TO authenticated USING (true);
CREATE POLICY select_statuses ON academic.statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY select_visibility_types ON academic.visibility_types FOR SELECT TO authenticated USING (true);

-- Hierarchy draft policies (development-safe, allows authenticated users of the same tenant or super_admins)
CREATE POLICY programs_policy ON academic.programs
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    );

CREATE POLICY courses_policy ON academic.courses
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    );

CREATE POLICY course_instructors_policy ON academic.course_instructors
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    );

CREATE POLICY modules_policy ON academic.modules
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    );

CREATE POLICY lessons_policy ON academic.lessons
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    );

CREATE POLICY lesson_resources_policy ON academic.lesson_resources
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM core.users WHERE auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
    );

-- 7. Audit Triggers
CREATE OR REPLACE FUNCTION academic.trg_audit_academic_program()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM core.log_audit(
            NEW.tenant_id,
            'academic_program_created',
            NEW.created_by,
            NULL,
            jsonb_build_object('program_id', NEW.id, 'title', NEW.title, 'slug', NEW.slug)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status_id != NEW.status_id THEN
            PERFORM core.log_audit(
                NEW.tenant_id,
                'academic_program_status_changed',
                NEW.updated_by,
                NULL,
                jsonb_build_object('program_id', NEW.id, 'old_status_id', OLD.status_id, 'new_status_id', NEW.status_id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_academic_program
    AFTER INSERT OR UPDATE ON academic.programs
    FOR EACH ROW
    EXECUTE FUNCTION academic.trg_audit_academic_program();

CREATE OR REPLACE FUNCTION academic.trg_audit_academic_course()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM core.log_audit(
            NEW.tenant_id,
            'academic_course_created',
            NEW.created_by,
            NULL,
            jsonb_build_object('course_id', NEW.id, 'title', NEW.title, 'slug', NEW.slug)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status_id != NEW.status_id THEN
            PERFORM core.log_audit(
                NEW.tenant_id,
                'academic_course_status_changed',
                NEW.updated_by,
                NULL,
                jsonb_build_object('course_id', NEW.id, 'old_status_id', OLD.status_id, 'new_status_id', NEW.status_id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_academic_course
    AFTER INSERT OR UPDATE ON academic.courses
    FOR EACH ROW
    EXECUTE FUNCTION academic.trg_audit_academic_course();
