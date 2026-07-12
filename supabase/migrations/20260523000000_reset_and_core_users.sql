-- 1. Clean up old tables
DROP TABLE IF EXISTS public.challenge_submissions CASCADE;
DROP TABLE IF EXISTS public.coding_challenges CASCADE;
DROP TABLE IF EXISTS public.course_topics CASCADE;
DROP TABLE IF EXISTS public.course_levels CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.institutions CASCADE;

-- 2. Create schema
CREATE SCHEMA IF NOT EXISTS core;

-- 3. Create users table
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    full_name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    tenant_id UUID,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_auth_user
        FOREIGN KEY (auth_user_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL
);

-- 4. Create indexes for performance
CREATE INDEX idx_users_auth_user_id ON core.users(auth_user_id);
CREATE INDEX idx_users_tenant_id ON core.users(tenant_id);
CREATE INDEX idx_users_email ON core.users(email);

-- 5. Trigger function to handle new auth user registrations
CREATE OR REPLACE FUNCTION core.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO core.users (
        auth_user_id,
        full_name,
        email,
        phone,
        avatar_url,
        tenant_id,
        status
    ) VALUES (
        NEW.id,
        coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.email,
        NEW.phone,
        coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
        nullif(NEW.raw_user_meta_data->>'tenant_id', '')::UUID,
        coalesce(NEW.raw_user_meta_data->>'status', 'active')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION core.handle_new_user();

-- 7. Trigger to update updated_at column automatically
CREATE OR REPLACE FUNCTION core.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON core.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON core.users
    FOR EACH ROW
    EXECUTE FUNCTION core.update_updated_at_column();
