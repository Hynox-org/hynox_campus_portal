-- 1. Teardown existing views, triggers, functions, and tables
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS audit_invitation_created ON core.user_invitations CASCADE;
DROP TRIGGER IF EXISTS audit_invitation_status_change ON core.user_invitations CASCADE;
DROP TRIGGER IF EXISTS audit_user_changes ON core.users CASCADE;
DROP TRIGGER IF EXISTS audit_role_assigned ON core.user_roles CASCADE;

DROP FUNCTION IF EXISTS core.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.set_user_role_claim(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS core.set_user_role_claim(UUID) CASCADE;
DROP FUNCTION IF EXISTS core.get_user_primary_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS core.log_audit(UUID, TEXT, UUID, UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS core.trg_audit_invitation_created() CASCADE;
DROP FUNCTION IF EXISTS core.trg_audit_invitation_status_change() CASCADE;
DROP FUNCTION IF EXISTS core.trg_audit_user_changes() CASCADE;
DROP FUNCTION IF EXISTS core.trg_audit_role_assigned() CASCADE;

DROP VIEW IF EXISTS public.user_invitations CASCADE;
DROP VIEW IF EXISTS public.user_roles CASCADE;
DROP VIEW IF EXISTS public.users CASCADE;

DROP TABLE IF EXISTS core.user_invitations CASCADE;
DROP TABLE IF EXISTS core.user_roles CASCADE;
DROP TABLE IF EXISTS core.role_permissions CASCADE;
DROP TABLE IF EXISTS core.permissions CASCADE;
DROP TABLE IF EXISTS core.roles CASCADE;
DROP TABLE IF EXISTS core.audit_logs CASCADE;
DROP TABLE IF EXISTS core.users CASCADE;
DROP TABLE IF EXISTS core.user_statuses CASCADE;
DROP TABLE IF EXISTS core.onboarding_sources CASCADE;
DROP TABLE IF EXISTS core.invitation_types CASCADE;
DROP TABLE IF EXISTS core.invitation_statuses CASCADE;

-- 2. Create Reference / Lookup Tables (Enables evolvable workflows without DDL modification)
CREATE TABLE core.user_statuses (
    code TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE core.onboarding_sources (
    code TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE core.invitation_types (
    code TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE core.invitation_statuses (
    code TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Lookup Tables
INSERT INTO core.user_statuses (code, description) VALUES
('invited', 'Profile pre-registered, invitation pending activation'),
('pending_activation', 'Invitation sent, awaiting user activation via login'),
('active', 'User account is active and fully functional'),
('suspended', 'User account is temporarily suspended'),
('inactive', 'User account is deactivated'),
('graduated', 'Student user has graduated'),
('blocked', 'User account is blocked from login')
ON CONFLICT (code) DO NOTHING;

INSERT INTO core.onboarding_sources (code, description) VALUES
('excel_import', 'Provisioned via administrative bulk spreadsheet import'),
('public_signup', 'Registered via public registration page'),
('admin_created', 'Manually created by portal administrator'),
('api_created', 'Provisioned via external API call')
ON CONFLICT (code) DO NOTHING;

INSERT INTO core.invitation_types (code, description) VALUES
('student_onboarding', 'Onboarding invitation for students'),
('trainer_onboarding', 'Onboarding invitation for trainers/instructors'),
('institution_admin_invite', 'Onboarding invitation for institution administrators'),
('mentor_invite', 'Onboarding invitation for mentors')
ON CONFLICT (code) DO NOTHING;

INSERT INTO core.invitation_statuses (code, description) VALUES
('created', 'Invitation registered, dispatch pending'),
('sent', 'Invitation email dispatched'),
('pending', 'Invitation is active and awaiting acceptance'),
('accepted', 'Invitation accepted and account linked'),
('expired', 'Invitation token has expired'),
('revoked', 'Invitation cancelled by administrator'),
('failed', 'Invitation dispatch failed')
ON CONFLICT (code) DO NOTHING;

-- 3. Create core business tables
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    tenant_id UUID, -- Tenant isolation column
    status TEXT NOT NULL REFERENCES core.user_statuses(code) DEFAULT 'invited',
    onboarding_source TEXT REFERENCES core.onboarding_sources(code),
    
    -- Hardened soft delete columns
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    delete_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE core.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0, -- Deterministic prioritization
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed deterministic roles
INSERT INTO core.roles (name, priority, description) VALUES
('super_admin', 100, 'Platform-level super administrator'),
('institution_admin', 80, 'Institution-level administrator (principals, HODs)'),
('trainer', 60, 'Course instructor and lab validator'),
('teacher', 60, 'Course instructor (legacy compatibility)'),
('mentor', 50, 'Student mentor'),
('student', 10, 'Student consumer of curriculum and challenges'),
('public', 0, 'Default unprivileged role')
ON CONFLICT (name) DO UPDATE SET priority = EXCLUDED.priority;

CREATE TABLE core.user_roles (
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE core.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE core.role_permissions (
    role_id UUID NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES core.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE core.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    tenant_id UUID, -- Tenant isolation column
    token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    invited_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    status TEXT NOT NULL REFERENCES core.invitation_statuses(code) DEFAULT 'created',
    invitation_type TEXT NOT NULL REFERENCES core.invitation_types(code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE core.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID, -- Tenant isolation column
    event_type TEXT NOT NULL,
    actor_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create indexes with soft-delete filtering
CREATE INDEX idx_users_auth_user_id ON core.users(auth_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_tenant_id ON core.users(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON core.users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON core.users(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_user_roles_user_id ON core.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON core.user_roles(role_id);

CREATE INDEX idx_user_invitations_user_id ON core.user_invitations(user_id);
CREATE INDEX idx_user_invitations_token ON core.user_invitations(token);
CREATE INDEX idx_user_invitations_status ON core.user_invitations(status);
CREATE INDEX idx_user_invitations_expires_at ON core.user_invitations(expires_at);
CREATE INDEX idx_user_invitations_tenant_id ON core.user_invitations(tenant_id);

CREATE INDEX idx_audit_logs_tenant_id ON core.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_event_type ON core.audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON core.audit_logs(created_at);

-- 5. Backfill existing auth users (mapped as active admin users)
INSERT INTO core.users (auth_user_id, full_name, email, avatar_url, status, onboarding_source)
SELECT 
    id,
    coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Akshaykumar'),
    email,
    coalesce(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture', ''),
    'active',
    'admin_created'
FROM auth.users
ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id, status = 'active';

INSERT INTO core.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM core.users u
CROSS JOIN core.roles r
WHERE u.email IN ('akshaykumar7.m@gmail.com', 'theakshaykumaryt@gmail.com', 'akshaykumar07.m@gmail.com')
  AND r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- 6. Grant schema permissions to Supabase roles
GRANT USAGE ON SCHEMA core TO postgres, authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA core TO postgres, authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core TO postgres, authenticated, anon, service_role;

-- 7. Compatibility Views (in public schema)
CREATE OR REPLACE VIEW public.users AS
SELECT id, auth_user_id, full_name, email, phone, avatar_url, tenant_id, status, onboarding_source, deleted_at, created_at, updated_at
FROM core.users
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.user_roles AS
SELECT ur.user_id, r.name AS role, ur.created_at
FROM core.user_roles ur
JOIN core.roles r ON ur.role_id = r.id;

CREATE OR REPLACE VIEW public.user_invitations AS
SELECT id, user_id, tenant_id, token, invited_by, expires_at, accepted_at, status, invitation_type, created_at, updated_at
FROM core.user_invitations;

GRANT ALL PRIVILEGES ON public.users TO postgres, authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON public.user_roles TO postgres, authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON public.user_invitations TO postgres, authenticated, anon, service_role;

-- 8. Create dynamic database procedures and functions
CREATE OR REPLACE FUNCTION core.log_audit(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_actor_user_id UUID,
    p_target_user_id UUID,
    p_metadata JSONB DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO core.audit_logs (tenant_id, event_type, actor_user_id, target_user_id, metadata)
    VALUES (p_tenant_id, p_event_type, p_actor_user_id, p_target_user_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deterministic primary role resolution
CREATE OR REPLACE FUNCTION core.get_user_primary_role(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    primary_role_name TEXT;
BEGIN
    SELECT r.name INTO primary_role_name
    FROM core.user_roles ur
    JOIN core.roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id OR ur.user_id = (SELECT id FROM core.users WHERE auth_user_id = target_user_id)
    ORDER BY r.priority DESC, r.name ASC
    LIMIT 1;
    
    RETURN COALESCE(primary_role_name, 'public');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sets role array and primary role claim in JWT app meta data
CREATE OR REPLACE FUNCTION core.set_user_role_claim(target_user_id UUID)
RETURNS void AS $$
DECLARE
    roles_array JSONB;
    primary_role_name TEXT;
BEGIN
    -- Fetch all roles for this user and compile them into a JSON array
    SELECT jsonb_agg(r.name) INTO roles_array
    FROM core.user_roles ur
    JOIN core.roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id OR ur.user_id = (SELECT id FROM core.users WHERE auth_user_id = target_user_id);

    -- Fetch primary role
    SELECT r.name INTO primary_role_name
    FROM core.user_roles ur
    JOIN core.roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id OR ur.user_id = (SELECT id FROM core.users WHERE auth_user_id = target_user_id)
    ORDER BY r.priority DESC, r.name ASC
    LIMIT 1;

    -- Fallback to 'public' if no roles were found
    IF roles_array IS NULL OR jsonb_array_length(roles_array) = 0 THEN
        roles_array := jsonb_build_array('public');
        primary_role_name := 'public';
    END IF;

    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) 
        || jsonb_build_object('role', primary_role_name) -- Single role for backward compatibility
        || jsonb_build_object('roles', roles_array) -- All roles for multi-role support
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Lightweight trigger auditing functions
CREATE OR REPLACE FUNCTION core.trg_audit_invitation_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM core.log_audit(
        NEW.tenant_id,
        'invitation_created',
        NEW.invited_by,
        NEW.user_id,
        jsonb_build_object('invitation_id', NEW.id, 'invitation_type', NEW.invitation_type)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_invitation_created
    AFTER INSERT ON core.user_invitations
    FOR EACH ROW
    EXECUTE FUNCTION core.trg_audit_invitation_created();

CREATE OR REPLACE FUNCTION core.trg_audit_invitation_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status AND NEW.status = 'accepted' THEN
        PERFORM core.log_audit(
            NEW.tenant_id,
            'invitation_accepted',
            NEW.user_id,
            NEW.user_id,
            jsonb_build_object('invitation_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_invitation_status_change
    AFTER UPDATE ON core.user_invitations
    FOR EACH ROW
    EXECUTE FUNCTION core.trg_audit_invitation_status_change();

CREATE OR REPLACE FUNCTION core.trg_audit_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Google account linked
    IF OLD.auth_user_id IS NULL AND NEW.auth_user_id IS NOT NULL THEN
        PERFORM core.log_audit(
            NEW.tenant_id,
            'google_account_linked',
            NEW.id,
            NEW.id,
            jsonb_build_object('auth_user_id', NEW.auth_user_id)
        );
    END IF;

    -- User activated
    IF OLD.status != NEW.status AND NEW.status = 'active' THEN
        PERFORM core.log_audit(
            NEW.tenant_id,
            'user_activated',
            NEW.id,
            NEW.id,
            NULL
        );
    END IF;

    -- User suspended
    IF OLD.status != NEW.status AND NEW.status = 'suspended' THEN
        PERFORM core.log_audit(
            NEW.tenant_id,
            'user_suspended',
            NEW.id,
            NEW.id,
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_user_changes
    AFTER UPDATE ON core.users
    FOR EACH ROW
    EXECUTE FUNCTION core.trg_audit_user_changes();

CREATE OR REPLACE FUNCTION core.trg_audit_role_assigned()
RETURNS TRIGGER AS $$
DECLARE
    r_name TEXT;
    u_tenant_id UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION core.trg_audit_role_assigned()
RETURNS TRIGGER AS $$
DECLARE
    r_name TEXT;
    u_tenant_id UUID;
BEGIN
    SELECT name INTO r_name FROM core.roles WHERE id = NEW.role_id;
    SELECT tenant_id INTO u_tenant_id FROM core.users WHERE id = NEW.user_id;
    
    PERFORM core.log_audit(
        u_tenant_id,
        'role_assigned',
        NULL,
        NEW.user_id,
        jsonb_build_object('role', r_name)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_role_assigned
    AFTER INSERT ON core.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION core.trg_audit_role_assigned();

-- 10. Recreate core.handle_new_user trigger on auth.users (enforces soft-delete checking and dynamic claim assignment)
CREATE OR REPLACE FUNCTION core.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_id UUID;
    public_role_id UUID;
    existing_status TEXT;
    existing_deleted_at TIMESTAMPTZ;
BEGIN
    -- Get the ID of the public role
    SELECT id INTO public_role_id FROM core.roles WHERE name = 'public';

    -- Check if user exists (including soft-deleted)
    SELECT id, status, deleted_at INTO existing_user_id, existing_status, existing_deleted_at
    FROM core.users
    WHERE email = NEW.email;

    -- If user is soft-deleted, block linkage
    IF existing_user_id IS NOT NULL AND existing_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'This user account has been soft-deleted and cannot be registered.';
    END IF;

    IF existing_user_id IS NOT NULL THEN
        -- Link existing user to auth.users.id
        UPDATE core.users
        SET 
            auth_user_id = NEW.id,
            full_name = coalesce(nullif(full_name, ''), coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')),
            avatar_url = coalesce(nullif(avatar_url, ''), coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')),
            status = 'active',
            updated_at = now()
        WHERE id = existing_user_id;

        -- Update any active invitations for this user to 'accepted'
        UPDATE core.user_invitations
        SET 
            status = 'accepted',
            accepted_at = now(),
            updated_at = now()
        WHERE user_id = existing_user_id AND status IN ('created', 'sent', 'pending');
    ELSE
        -- Insert a new user record
        INSERT INTO core.users (
            id,
            auth_user_id,
            full_name,
            email,
            phone,
            avatar_url,
            tenant_id,
            status,
            onboarding_source
        ) VALUES (
            NEW.id,
            NEW.id,
            coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
            NEW.email,
            NEW.phone,
            coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
            nullif(NEW.raw_user_meta_data->>'tenant_id', '')::UUID,
            'active',
            'public_signup'
        )
        RETURNING id INTO existing_user_id;

        -- Assign default 'public' role
        INSERT INTO core.user_roles (user_id, role_id)
        VALUES (existing_user_id, public_role_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Attach trigger to set auth role claim automatically
    PERFORM core.set_user_role_claim(NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION core.handle_new_user();
