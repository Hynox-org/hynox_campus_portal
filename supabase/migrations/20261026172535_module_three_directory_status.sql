DO $migration$
DECLARE signature text; original text; revised text;
BEGIN
  FOREACH signature IN ARRAY ARRAY['public.get_teacher_programs(uuid)','public.get_teacher_institutions_and_programs(uuid)'] LOOP
    SELECT pg_get_functiondef(signature::regprocedure) INTO original;
    IF signature='public.get_teacher_programs(uuid)' THEN
      revised:=replace(original,'JOIN institution.institutions i ON i.id=m.id',
        'JOIN institution.institutions i ON i.id=m.id AND (i.status NOT IN(''inactive'',''suspended'') OR EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE ''super_admin''=ANY(cu.roles)))');
    ELSE
      revised:=replace(original,'JOIN institution.institutions i ON id.inst_id = i.id',
        'JOIN institution.institutions i ON id.inst_id = i.id AND (i.status NOT IN(''inactive'',''suspended'') OR EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE ''super_admin''=ANY(cu.roles)))');
    END IF;
    IF revised=original THEN RAISE EXCEPTION 'Expected directory query not found: %',signature; END IF;
    EXECUTE revised;
  END LOOP;
END $migration$;
