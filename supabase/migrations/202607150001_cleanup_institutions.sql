-- Migration to cleanup institutions: drop slug column and reduce institution categories
-- Created: 2026-07-15

-- 1. Redefine trigger function to not reference slug
CREATE OR REPLACE FUNCTION institution.trg_audit_institution_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM core.log_audit(
        NEW.id, -- tenant_id
        'institution_created',
        NEW.created_by,
        NULL,
        jsonb_build_object('institution_name', NEW.name, 'institution_code', NEW.institution_code)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the slug index and column
DROP INDEX IF EXISTS institution.idx_institutions_slug;
ALTER TABLE institution.institutions DROP COLUMN IF EXISTS slug;

-- 3. Ensure 'others' type exists
INSERT INTO institution.institution_types (code, description)
VALUES ('others', 'Other education or training provider')
ON CONFLICT (code) DO NOTHING;

-- 4. Migrate any existing institutions that use types to be deleted to 'others'
UPDATE institution.institutions
SET institution_type = 'others'
WHERE institution_type NOT IN ('school', 'college');

-- 5. Delete all other institution types
DELETE FROM institution.institution_types
WHERE code NOT IN ('school', 'college', 'others');
