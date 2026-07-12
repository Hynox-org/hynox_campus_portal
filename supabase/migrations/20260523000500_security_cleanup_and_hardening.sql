-- Migration: Phase 1 Final Security Hardening and Cleanup Pass
-- Path: supabase/migrations/20260523000500_security_cleanup_and_hardening.sql

-- 1. Drop old public functions (no longer used)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- 2. Re-create / Alter functions in core schema to define static search_path and harden logic
CREATE OR REPLACE FUNCTION core.get_current_user()
RETURNS TABLE (
    user_id UUID,
    tenant_id UUID,
    roles TEXT[],
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id AS user_id,
        u.tenant_id,
        COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}'::TEXT[]) AS roles,
        u.status
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.auth_user_id = auth.uid() AND u.deleted_at IS NULL
    GROUP BY u.id, u.tenant_id, u.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = core, auth, pg_catalog;

CREATE OR REPLACE FUNCTION core.get_user_tenant_id(p_user_id UUID)
RETURNS UUID AS $$
    SELECT tenant_id FROM users WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = core, pg_catalog;

CREATE OR REPLACE FUNCTION core.get_user_primary_role(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    primary_role_name TEXT;
BEGIN
    SELECT r.name INTO primary_role_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id OR ur.user_id = (SELECT id FROM users WHERE auth_user_id = target_user_id)
    ORDER BY r.priority DESC, r.name ASC
    LIMIT 1;
    
    RETURN COALESCE(primary_role_name, 'public');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = core, pg_catalog;

CREATE OR REPLACE FUNCTION core.log_audit(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_actor_user_id UUID,
    p_target_user_id UUID,
    p_metadata JSONB DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO audit_logs (tenant_id, event_type, actor_user_id, target_user_id, metadata)
    VALUES (p_tenant_id, p_event_type, p_actor_user_id, p_target_user_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog;

CREATE OR REPLACE FUNCTION core.set_user_role_claim(target_user_id UUID)
RETURNS void AS $$
DECLARE
    roles_array JSONB;
    primary_role_name TEXT;
BEGIN
    -- HARDENING CHECK: Only allow the caller to set claims for their own account, unless they are a superadmin
    IF target_user_id != auth.uid() AND NOT EXISTS (
        SELECT 1 FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.auth_user_id = auth.uid() AND r.name = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: You can only set claims for your own account.';
    END IF;

    -- Fetch all roles for this user and compile them into a JSON array
    SELECT jsonb_agg(r.name) INTO roles_array
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id OR ur.user_id = (SELECT id FROM users WHERE auth_user_id = target_user_id);

    -- Fetch primary role
    SELECT r.name INTO primary_role_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id OR ur.user_id = (SELECT id FROM users WHERE auth_user_id = target_user_id)
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, auth, pg_catalog;

-- Trigger functions in core schema
CREATE OR REPLACE FUNCTION core.trg_audit_invitation_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_audit(
        NEW.tenant_id,
        'invitation_created',
        NEW.invited_by,
        NEW.user_id,
        jsonb_build_object('invitation_id', NEW.id, 'invitation_type', NEW.invitation_type)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog;

CREATE OR REPLACE FUNCTION core.trg_audit_invitation_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status AND NEW.status = 'accepted' THEN
        PERFORM log_audit(
            NEW.tenant_id,
            'invitation_accepted',
            NEW.user_id,
            NEW.user_id,
            jsonb_build_object('invitation_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog;

CREATE OR REPLACE FUNCTION core.trg_audit_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Google account linked
    IF OLD.auth_user_id IS NULL AND NEW.auth_user_id IS NOT NULL THEN
        PERFORM log_audit(
            NEW.tenant_id,
            'google_account_linked',
            NEW.id,
            NEW.id,
            jsonb_build_object('auth_user_id', NEW.auth_user_id)
        );
    END IF;

    -- User activated
    IF OLD.status != NEW.status AND NEW.status = 'active' THEN
        PERFORM log_audit(
            NEW.tenant_id,
            'user_activated',
            NEW.id,
            NEW.id,
            NULL
        );
    END IF;

    -- User suspended
    IF OLD.status != NEW.status AND NEW.status = 'suspended' THEN
        PERFORM log_audit(
            NEW.tenant_id,
            'user_suspended',
            NEW.id,
            NEW.id,
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog;

CREATE OR REPLACE FUNCTION core.trg_audit_role_assigned()
RETURNS TRIGGER AS $$
DECLARE
    r_name TEXT;
    u_tenant_id UUID;
BEGIN
    SELECT name INTO r_name FROM roles WHERE id = NEW.role_id;
    SELECT tenant_id INTO u_tenant_id FROM users WHERE id = NEW.user_id;
    
    PERFORM log_audit(
        u_tenant_id,
        'role_assigned',
        NULL,
        NEW.user_id,
        jsonb_build_object('role', r_name)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog;

CREATE OR REPLACE FUNCTION core.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_id UUID;
    public_role_id UUID;
    existing_status TEXT;
    existing_deleted_at TIMESTAMPTZ;
BEGIN
    -- Get the ID of the public role
    SELECT id INTO public_role_id FROM roles WHERE name = 'public';

    -- Check if user exists (including soft-deleted)
    SELECT id, status, deleted_at INTO existing_user_id, existing_status, existing_deleted_at
    FROM users
    WHERE email = NEW.email;

    -- If user is soft-deleted, block linkage
    IF existing_user_id IS NOT NULL AND existing_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'This user account has been soft-deleted and cannot be registered.';
    END IF;

    IF existing_user_id IS NOT NULL THEN
        -- Link existing user to auth.users.id
        UPDATE users
        SET 
            auth_user_id = NEW.id,
            full_name = coalesce(nullif(full_name, ''), coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')),
            avatar_url = coalesce(nullif(avatar_url, ''), coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')),
            status = 'active',
            updated_at = now()
        WHERE id = existing_user_id;

        -- Update any active invitations for this user to 'accepted'
        UPDATE user_invitations
        SET 
            status = 'accepted',
            accepted_at = now(),
            updated_at = now()
        WHERE user_id = existing_user_id AND status IN ('created', 'sent', 'pending');
    ELSE
        -- Insert a new user record
        INSERT INTO users (
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
        INSERT INTO user_roles (user_id, role_id)
        VALUES (existing_user_id, public_role_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Attach trigger to set auth role claim automatically
    PERFORM set_user_role_claim(NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, auth, pg_catalog;

-- 3. Re-create functions in institution schema to define static search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = institution, core, pg_catalog;

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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = institution, core, pg_catalog;

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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = institution, core, pg_catalog;

CREATE OR REPLACE FUNCTION core.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = core, pg_catalog;

-- 4. Revoke and Grant Permissions on Functions
-- Trigger functions: run by database system, not executable by standard user roles
REVOKE EXECUTE ON FUNCTION core.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION core.trg_audit_invitation_created() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION core.trg_audit_invitation_status_change() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION core.trg_audit_user_changes() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION core.trg_audit_role_assigned() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION institution.trg_audit_institution_created() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION institution.trg_audit_institution_admin_assigned() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION institution.trg_audit_institution_suspended() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION core.update_updated_at_column() FROM public, anon, authenticated;

-- Helper functions: restrict public execute
REVOKE EXECUTE ON FUNCTION core.get_current_user() FROM public, anon;
GRANT EXECUTE ON FUNCTION core.get_current_user() TO authenticated, anon, service_role, postgres;

REVOKE EXECUTE ON FUNCTION core.get_user_tenant_id(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION core.get_user_tenant_id(UUID) TO authenticated, service_role, postgres;

REVOKE EXECUTE ON FUNCTION core.get_user_primary_role(UUID) FROM public;
GRANT EXECUTE ON FUNCTION core.get_user_primary_role(UUID) TO authenticated, anon, service_role, postgres;

REVOKE EXECUTE ON FUNCTION core.set_user_role_claim(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION core.set_user_role_claim(UUID) TO authenticated, service_role, postgres;
