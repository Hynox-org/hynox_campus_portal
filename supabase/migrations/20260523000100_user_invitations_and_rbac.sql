-- 1. Create roles table
CREATE TABLE IF NOT EXISTS core.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Seed default roles
INSERT INTO core.roles (name, description) VALUES
('super_admin', 'Platform-level super administrator'),
('institution_admin', 'Institution-level administrator (principals, HODs)'),
('teacher', 'Course instructor and lab validator'),
('student', 'Student consumer of curriculum and challenges'),
('public', 'Default unprivileged role')
ON CONFLICT (name) DO NOTHING;

-- 3. Create user_roles join table (for multi-role mapping)
CREATE TABLE IF NOT EXISTS core.user_roles (
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

-- 4. Create user_invitations table (decoupled invitation lifecycle)
CREATE TABLE IF NOT EXISTS core.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    invited_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON core.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON core.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_user_id ON core.user_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON core.user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON core.user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON core.user_invitations(expires_at);

-- 6. Assign existing users to 'super_admin' role in core.user_roles
INSERT INTO core.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM core.users u
CROSS JOIN core.roles r
WHERE u.email IN ('akshaykumar7.m@gmail.com', 'theakshaykumaryt@gmail.com', 'akshaykumar07.m@gmail.com')
  AND r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- 7. Grant schema usage and permissions to Supabase roles
GRANT USAGE ON SCHEMA core TO postgres, authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA core TO postgres, authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core TO postgres, authenticated, anon, service_role;

-- 8. Create public views for client-side backward compatibility
CREATE OR REPLACE VIEW public.users AS
SELECT id, auth_user_id, full_name, email, phone, avatar_url, tenant_id, status, created_at, updated_at
FROM core.users;

CREATE OR REPLACE VIEW public.user_roles AS
SELECT ur.user_id, r.name AS role, ur.created_at
FROM core.user_roles ur
JOIN core.roles r ON ur.role_id = r.id;

CREATE OR REPLACE VIEW public.user_invitations AS
SELECT id, user_id, token, invited_by, expires_at, accepted_at, status, created_at, updated_at
FROM core.user_invitations;

GRANT ALL PRIVILEGES ON public.users TO postgres, authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON public.user_roles TO postgres, authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON public.user_invitations TO postgres, authenticated, anon, service_role;

-- 9. Update the auth.users trigger to support RBAC and invitations
CREATE OR REPLACE FUNCTION core.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_id UUID;
    public_role_id UUID;
BEGIN
    -- Get the ID of the public role
    SELECT id INTO public_role_id FROM core.roles WHERE name = 'public';

    -- Check if a user with this email already exists in core.users
    SELECT id INTO existing_user_id
    FROM core.users
    WHERE email = NEW.email;

    IF existing_user_id IS NOT NULL THEN
        -- Link existing user to auth.users.id
        UPDATE core.users
        SET 
            auth_user_id = NEW.id,
            full_name = coalesce(nullif(full_name, ''), coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')),
            avatar_url = coalesce(nullif(avatar_url, ''), coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')),
            updated_at = now()
        WHERE id = existing_user_id;

        -- Update any pending invitations for this user to 'accepted'
        UPDATE core.user_invitations
        SET 
            status = 'accepted',
            accepted_at = now(),
            updated_at = now()
        WHERE user_id = existing_user_id AND status = 'pending';
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
            status
        ) VALUES (
            NEW.id,
            NEW.id,
            coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
            NEW.email,
            NEW.phone,
            coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
            nullif(NEW.raw_user_meta_data->>'tenant_id', '')::UUID,
            coalesce(NEW.raw_user_meta_data->>'status', 'active')
        )
        RETURNING id INTO existing_user_id;

        -- Assign the default 'public' role to the brand new user
        INSERT INTO core.user_roles (user_id, role_id)
        VALUES (existing_user_id, public_role_id)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Update public.set_user_role_claim function to set role and roles list in JWT
CREATE OR REPLACE FUNCTION public.set_user_role_claim(target_user_id UUID, target_role TEXT)
RETURNS void AS $$
DECLARE
    roles_array JSONB;
BEGIN
    -- Fetch all roles for this user and compile them into a JSON array
    SELECT jsonb_agg(r.name) INTO roles_array
    FROM core.user_roles ur
    JOIN core.roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id OR ur.user_id = (SELECT id FROM core.users WHERE auth_user_id = target_user_id);

    -- Fallback to the target_role if no roles were found in user_roles table
    IF roles_array IS NULL OR jsonb_array_length(roles_array) = 0 THEN
        roles_array := jsonb_build_array(target_role);
    END IF;

    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) 
        || jsonb_build_object('role', target_role) -- Single role for backward compatibility
        || jsonb_build_object('roles', roles_array) -- All roles for multi-role support
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
