-- 1. Create the schema
CREATE SCHEMA IF NOT EXISTS institution;

-- 2. Drop existing constraints, functions, and tables to prepare for clean recreate
ALTER TABLE core.users DROP CONSTRAINT IF EXISTS fk_user_tenant;
ALTER TABLE core.user_invitations DROP CONSTRAINT IF EXISTS fk_invitation_tenant;
ALTER TABLE core.audit_logs DROP CONSTRAINT IF EXISTS fk_audit_tenant;

DROP FUNCTION IF EXISTS institution.trg_audit_institution_created() CASCADE;
DROP FUNCTION IF EXISTS institution.trg_audit_institution_admin_assigned() CASCADE;
DROP FUNCTION IF EXISTS institution.trg_audit_institution_suspended() CASCADE;

DROP TABLE IF EXISTS institution.institution_admins CASCADE;
DROP TABLE IF EXISTS institution.institutions CASCADE;
DROP TABLE IF EXISTS institution.institution_types CASCADE;
DROP TABLE IF EXISTS institution.institution_statuses CASCADE;

-- 3. Create Lookup Tables (Natural Key design)
CREATE TABLE institution.institution_types (
    code TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE institution.institution_statuses (
    code TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Lookup Tables
INSERT INTO institution.institution_types (code, description) VALUES
('school', 'General school education provider'),
('college', 'Higher undergraduate/postgraduate college'),
('university', 'University institution mapping multiple campuses'),
('training_center', 'Professional training partner or vocational center'),
('corporate_partner', 'Corporate training or hiring client partner')
ON CONFLICT (code) DO NOTHING;

INSERT INTO institution.institution_statuses (code, description) VALUES
('active', 'Institution account is active'),
('inactive', 'Institution account is deactivated'),
('suspended', 'Institution account is suspended from platform access'),
('onboarding', 'Institution profile created, onboarding pending')
ON CONFLICT (code) DO NOTHING;

-- 4. Create core business tables in institution schema
CREATE TABLE institution.institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- Dashboard/URL subdomains
    institution_code TEXT UNIQUE NOT NULL, -- Distinct unique identifier
    institution_type TEXT NOT NULL REFERENCES institution.institution_types(code),
    email TEXT UNIQUE,
    phone TEXT,
    address TEXT,
    website TEXT,
    logo_url TEXT,
    status TEXT NOT NULL REFERENCES institution.institution_statuses(code) DEFAULT 'onboarding',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL -- Creator FK link
);

CREATE TABLE institution.institution_admins (
    institution_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    role_scope TEXT DEFAULT 'primary', -- Scalable scopes (e.g. primary, billing, academic)
    PRIMARY KEY (institution_id, user_id)
);

-- 5. Add FK constraints to core schema tables (linking to institution.institutions.id)
ALTER TABLE core.users 
    ADD CONSTRAINT fk_user_tenant 
    FOREIGN KEY (tenant_id) 
    REFERENCES institution.institutions(id) 
    ON DELETE SET NULL;

ALTER TABLE core.user_invitations 
    ADD CONSTRAINT fk_invitation_tenant 
    FOREIGN KEY (tenant_id) 
    REFERENCES institution.institutions(id) 
    ON DELETE SET NULL;

ALTER TABLE core.audit_logs 
    ADD CONSTRAINT fk_audit_tenant 
    FOREIGN KEY (tenant_id) 
    REFERENCES institution.institutions(id) 
    ON DELETE SET NULL;

-- 6. Create indexes for performance
CREATE INDEX idx_institutions_slug ON institution.institutions(slug);
CREATE INDEX idx_institutions_code ON institution.institutions(institution_code);
CREATE INDEX idx_institutions_status ON institution.institutions(status);
CREATE INDEX idx_institution_admins_user_id ON institution.institution_admins(user_id);

-- 7. Grant schema usage and permissions (Exclude anon, allow postgres, authenticated, service_role)
REVOKE ALL ON SCHEMA institution FROM public, anon;
REVOKE ALL ON ALL TABLES IN SCHEMA institution FROM public, anon;

GRANT USAGE ON SCHEMA institution TO postgres, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA institution TO postgres, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA institution TO postgres, authenticated, service_role;

-- 8. Create trigger functions for automated audit logging
CREATE OR REPLACE FUNCTION institution.trg_audit_institution_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM core.log_audit(
        NEW.id, -- tenant_id
        'institution_created',
        NEW.created_by,
        NULL,
        jsonb_build_object('institution_name', NEW.name, 'institution_code', NEW.institution_code, 'slug', NEW.slug)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_institution_created
    AFTER INSERT ON institution.institutions
    FOR EACH ROW
    EXECUTE FUNCTION institution.trg_audit_institution_created();

CREATE OR REPLACE FUNCTION institution.trg_audit_institution_admin_assigned()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM core.log_audit(
        NEW.institution_id, -- tenant_id
        'institution_admin_assigned',
        NEW.assigned_by,
        NEW.user_id,
        jsonb_build_object('role_scope', NEW.role_scope)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_institution_admin_assigned
    AFTER INSERT ON institution.institution_admins
    FOR EACH ROW
    EXECUTE FUNCTION institution.trg_audit_institution_admin_assigned();

CREATE OR REPLACE FUNCTION institution.trg_audit_institution_suspended()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status AND NEW.status = 'suspended' THEN
        PERFORM core.log_audit(
            NEW.id, -- tenant_id
            'institution_suspended',
            NULL,
            NULL,
            NULL
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_institution_suspended
    AFTER UPDATE ON institution.institutions
    FOR EACH ROW
    EXECUTE FUNCTION institution.trg_audit_institution_suspended();
