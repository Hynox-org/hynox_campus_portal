-- Client roles cannot forge worker leases, attempts or delivery acknowledgements.
CREATE FUNCTION core.guard_invitation_outbox() RETURNS trigger
LANGUAGE plpgsql SET search_path=core,pg_catalog AS $$
BEGIN
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.mail_state<>'none' OR NEW.mail_attempts<>0 OR NEW.mail_lease IS NOT NULL
      OR NEW.mail_lease_until IS NOT NULL OR NEW.mail_message_id IS NOT NULL THEN
      RAISE EXCEPTION 'Email dispatch requires the onboarding transaction' USING ERRCODE='42501';
    END IF;
  ELSIF ROW(NEW.mail_state,NEW.mail_attempts,NEW.mail_next_attempt_at,NEW.mail_lease,NEW.mail_lease_until,NEW.mail_message_id)
    IS DISTINCT FROM ROW(OLD.mail_state,OLD.mail_attempts,OLD.mail_next_attempt_at,OLD.mail_lease,OLD.mail_lease_until,OLD.mail_message_id) THEN
    -- Closing an invitation may cancel its queue entry through the earlier status trigger.
    IF NOT (NEW.status IN ('accepted','expired','revoked') AND NEW.mail_state='cancelled'
      AND NEW.mail_attempts=OLD.mail_attempts AND NEW.mail_next_attempt_at=OLD.mail_next_attempt_at
      AND NEW.mail_lease IS NULL AND NEW.mail_lease_until IS NULL AND NEW.mail_message_id IS NOT DISTINCT FROM OLD.mail_message_id) THEN
      RAISE EXCEPTION 'Email dispatch is backend managed' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION core.guard_invitation_outbox() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_invitation_outbox BEFORE INSERT OR UPDATE ON core.user_invitations
FOR EACH ROW EXECUTE FUNCTION core.guard_invitation_outbox();
NOTIFY pgrst,'reload schema';
