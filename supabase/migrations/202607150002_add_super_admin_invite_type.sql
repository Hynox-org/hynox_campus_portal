-- Register the "super_admin_invite" invitation type used by the admin panel's
-- Super Admin Onboarding flow. Without this row, inserts into
-- core.user_invitations with invitation_type = 'super_admin_invite' fail the
-- FK constraint against core.invitation_types(code).
INSERT INTO core.invitation_types (code, description) VALUES
('super_admin_invite', 'Onboarding invitation for platform super administrators')
ON CONFLICT (code) DO NOTHING;
