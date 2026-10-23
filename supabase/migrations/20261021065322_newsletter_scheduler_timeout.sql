CREATE OR REPLACE FUNCTION learning.newsletter_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_url text; v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM learning.newsletter_settings WHERE id AND enabled) THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name='campus_newsletter_function_url';
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name='campus_newsletter_scheduler_token';
  IF v_url IS NULL OR v_token IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','x-newsletter-token',v_token),body:='{}'::jsonb,timeout_milliseconds:=120000);
END;
$$;
