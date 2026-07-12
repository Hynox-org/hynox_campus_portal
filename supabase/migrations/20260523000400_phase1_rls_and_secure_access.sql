-- Migration: Phase 1 Tenant Isolation and Secure Access Layer
-- Path: supabase/migrations/20260523000400_phase1_rls_and_secure_access.sql

-- 1. Create Helper Functions
-- Resolve the current business user details safely via SECURITY DEFINER (bypassing RLS recursion)
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
    FROM core.users u
    LEFT JOIN core.user_roles ur ON u.id = ur.user_id
    LEFT JOIN core.roles r ON ur.role_id = r.id
    WHERE u.auth_user_id = auth.uid() AND u.deleted_at IS NULL
    GROUP BY u.id, u.tenant_id, u.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Resolve a user's tenant_id safely (used in policies to prevent RLS recursion)
CREATE OR REPLACE FUNCTION core.get_user_tenant_id(p_user_id UUID)
RETURNS UUID AS $$
    SELECT tenant_id FROM core.users WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Enable Row Level Security (RLS) on core tables
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Enable Row Level Security (RLS) on institution tables
ALTER TABLE institution.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution.institution_admins ENABLE ROW LEVEL SECURITY;

-- 4. Define Policies for core.users
DROP POLICY IF EXISTS users_select ON core.users;
DROP POLICY IF EXISTS users_insert ON core.users;
DROP POLICY IF EXISTS users_update ON core.users;
DROP POLICY IF EXISTS users_delete ON core.users;

CREATE POLICY users_select ON core.users
FOR SELECT
USING (
    (auth.role() = 'authenticated' AND (
        (auth_user_id = auth.uid() AND deleted_at IS NULL)
        OR EXISTS (
            SELECT 1 FROM core.get_current_user() cu
            WHERE 'super_admin' = ANY(cu.roles)
            OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.users.tenant_id)
        )
    ))
    OR (auth.role() = 'anon' AND id IN (
        SELECT user_id FROM core.user_invitations
        WHERE status IN ('created', 'sent', 'pending')
    ))
);

CREATE POLICY users_insert ON core.users
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = tenant_id)
    )
);

CREATE POLICY users_update ON core.users
FOR UPDATE
TO authenticated
USING (
    (auth_user_id = auth.uid() AND deleted_at IS NULL)
    OR EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.users.tenant_id)
    )
)
WITH CHECK (
    (auth_user_id = auth.uid() AND deleted_at IS NULL)
    OR EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = tenant_id)
    )
);

CREATE POLICY users_delete ON core.users
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.users.tenant_id)
    )
);

-- 5. Define Policies for core.user_roles
DROP POLICY IF EXISTS user_roles_select ON core.user_roles;
DROP POLICY IF EXISTS user_roles_insert ON core.user_roles;
DROP POLICY IF EXISTS user_roles_update ON core.user_roles;
DROP POLICY IF EXISTS user_roles_delete ON core.user_roles;

CREATE POLICY user_roles_select ON core.user_roles
FOR SELECT
TO authenticated
USING (
    user_id = (SELECT user_id FROM core.get_current_user())
    OR EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.get_user_tenant_id(user_id))
    )
);

CREATE POLICY user_roles_insert ON core.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.get_user_tenant_id(user_id))
    )
);

CREATE POLICY user_roles_update ON core.user_roles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.get_user_tenant_id(user_id))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.get_user_tenant_id(user_id))
    )
);

CREATE POLICY user_roles_delete ON core.user_roles
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.get_user_tenant_id(user_id))
    )
);

-- 6. Define Policies for core.user_invitations
DROP POLICY IF EXISTS user_invitations_select ON core.user_invitations;
DROP POLICY IF EXISTS user_invitations_insert ON core.user_invitations;
DROP POLICY IF EXISTS user_invitations_update ON core.user_invitations;
DROP POLICY IF EXISTS user_invitations_delete ON core.user_invitations;

CREATE POLICY user_invitations_select ON core.user_invitations
FOR SELECT
USING (
    (auth.role() = 'authenticated' AND (
        user_id = (SELECT user_id FROM core.get_current_user())
        OR EXISTS (
            SELECT 1 FROM core.get_current_user() cu
            WHERE 'super_admin' = ANY(cu.roles)
            OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.user_invitations.tenant_id)
        )
    ))
    OR (auth.role() = 'anon' AND status IN ('created', 'sent', 'pending'))
);

CREATE POLICY user_invitations_insert ON core.user_invitations
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = tenant_id)
    )
);

CREATE POLICY user_invitations_update ON core.user_invitations
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.user_invitations.tenant_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = tenant_id)
    )
);

CREATE POLICY user_invitations_delete ON core.user_invitations
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.user_invitations.tenant_id)
    )
);

-- 7. Define Policies for core.audit_logs
DROP POLICY IF EXISTS audit_logs_select ON core.audit_logs;

CREATE POLICY audit_logs_select ON core.audit_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.audit_logs.tenant_id)
    )
);

-- 8. Define Policies for institution.institutions
DROP POLICY IF EXISTS institutions_select ON institution.institutions;
DROP POLICY IF EXISTS institutions_insert ON institution.institutions;
DROP POLICY IF EXISTS institutions_update ON institution.institutions;
DROP POLICY IF EXISTS institutions_delete ON institution.institutions;

CREATE POLICY institutions_select ON institution.institutions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR cu.tenant_id = id
    )
);

CREATE POLICY institutions_insert ON institution.institutions
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
    )
);

CREATE POLICY institutions_update ON institution.institutions
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = id)
    )
);

CREATE POLICY institutions_delete ON institution.institutions
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
    )
);

-- 9. Define Policies for institution.institution_admins
DROP POLICY IF EXISTS institution_admins_select ON institution.institution_admins;
DROP POLICY IF EXISTS institution_admins_insert ON institution.institution_admins;
DROP POLICY IF EXISTS institution_admins_update ON institution.institution_admins;
DROP POLICY IF EXISTS institution_admins_delete ON institution.institution_admins;

CREATE POLICY institution_admins_select ON institution.institution_admins
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR cu.tenant_id = institution_id
    )
);

CREATE POLICY institution_admins_insert ON institution.institution_admins
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = institution_id)
    )
);

CREATE POLICY institution_admins_update ON institution.institution_admins
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = institution_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = institution_id)
    )
);

CREATE POLICY institution_admins_delete ON institution.institution_admins
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM core.get_current_user() cu
        WHERE 'super_admin' = ANY(cu.roles)
        OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = institution_id)
    )
);
