const fs=require('fs');let s=fs.readFileSync('supabase/migrations/20261029052350_correct_progress_snapshot_campus_schema.sql','utf8');
s=s.replace('declare actor record; result jsonb; forbidden boolean;','declare actor record; result jsonb; forbidden boolean; worker boolean=coalesce(auth.jwt()->>\'role\',\'\')=\'service_role\';');
s=s.replace("if actor.user_id is null or actor.status <> 'active' then", "if not worker and (actor.user_id is null or actor.status <> 'active') then");
s=s.replace("if not actor.roles && array", "if not worker and not actor.roles && array");
s=s.replace("(u.id=actor.user_id or 'super_admin'=any(actor.roles)","(worker or u.id=actor.user_id or 'super_admin'=any(actor.roles)");
s=s.replace('else round(100.0*(t.completed_lessons+t.completed_activities)/(t.total_lessons+t.total_activities),2) end progress_percentage,',`when t.completed_lessons+t.completed_activities=t.total_lessons+t.total_activities then 100::numeric
        else least(99.99,round(100.0*(t.completed_lessons+t.completed_activities)/(t.total_lessons+t.total_activities),2)) end progress_percentage,`);
s+='\n-- Only a signed server role may calculate outside an authenticated user session.\ngrant execute on function delivery.course_progress_snapshot(uuid[],uuid[]) to service_role;\ngrant execute on function delivery.refresh_course_progress(uuid,uuid) to service_role;\n';
fs.writeFileSync('supabase/migrations/20261029052853_exact_progress_completion_and_worker_access.sql',s);
