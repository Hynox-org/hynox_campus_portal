-- User-authorized retained synthetic browser fixture; existing learning records stay unchanged.
begin;
create temp table manual_ids as select gen_random_uuid() course,gen_random_uuid() module,gen_random_uuid() lesson,
 '5b887eaa-8f3e-4c7a-aa12-06c07138e916'::uuid campus,'f46fc2ee-393d-4595-a4dd-bdf743870b01'::uuid program,
 '2d5a7ac0-67c2-4c7d-8255-494b718be3ff'::uuid cohort;
insert into academic.courses(id,program_id,tenant_id,institution_id,title,slug,description,status_id,visibility_type_id)
 select course,program,campus,campus,'QA M789 Progress and Activities','qa-m789-'||course::text,
 'Synthetic QA: one lesson, one required quiz and one required project. Optional work must not block completion.',
 (select id from academic.statuses where code='active'),(select id from academic.visibility_types where code='tenant_only') from manual_ids;
insert into delivery.course_assignments(cohort_id,course_id,is_required) select cohort,course,true from manual_ids;
insert into academic.modules(id,course_id,tenant_id,institution_id,title,position,status_id)
 select module,course,campus,campus,'QA Learning Progress',1,(select id from academic.statuses where code='active') from manual_ids;
insert into academic.lessons(id,module_id,tenant_id,institution_id,title,position,status_id,lesson_type_id,content_json)
 select lesson,module,campus,campus,'QA Required Learning Lesson',1,(select id from academic.statuses where code='active'),
 (select id from academic.lesson_types where code='text'),'{"text":"# Progress verification\n\nComplete this lesson, pass the required quiz and receive project approval. Each contributes one third of this course. Optional activities must not block 100%."}'::jsonb from manual_ids;
select set_config('request.jwt.claim.sub',(select auth_user_id::text from core.users where email='thehynoxofficial@gmail.com' and deleted_at is null),true);
create temp table manual_activities(kind text,payload jsonb);
insert into manual_activities select 'quiz',learning.save_activity(null,jsonb_build_object('tenant_id',campus,'institution_id',campus,'lesson_id',lesson,
 'activity_type_code','quiz','status_code','published','title','QA Required Quiz - Four Question Formats','max_score',100,'passing_score',60,
 'quiz_time_limit',30,'quiz_max_attempts',1,'questions',
 '[{"question_text":"Choose the word Campus","question_type":"single_choice","points":2,"position":1,"options":[{"optionText":"Campus","isCorrect":true,"position":1},{"optionText":"Ocean","isCorrect":false,"position":2}]},{"question_text":"Select both learning activities","question_type":"multiple_choice","points":2,"position":2,"options":[{"optionText":"Quiz","isCorrect":true,"position":1},{"optionText":"Project","isCorrect":true,"position":2},{"optionText":"Weather","isCorrect":false,"position":3}]},{"question_text":"Optional work must not block 100 percent","question_type":"true_false","points":2,"position":3,"options":[{"optionText":"True","isCorrect":true,"position":1},{"optionText":"False","isCorrect":false,"position":2}]},{"question_text":"Type the word Campus","question_type":"short_answer","points":2,"position":4,"options":[{"optionText":"Campus","isCorrect":true,"position":1}]}]'::jsonb,
 'assignments',jsonb_build_array(jsonb_build_object('cohort_id',cohort,'is_required',true)))) from manual_ids;
insert into manual_activities select 'project',learning.save_activity(null,jsonb_build_object('tenant_id',campus,'institution_id',campus,'lesson_id',lesson,
 'activity_type_code','project','status_code','published','title','QA Required Project - Review Workflow','max_score',100,'passing_score',60,
 'project_overview','Submit a synthetic GitHub repository URL for review. No real coursework is required.','project_difficulty','intermediate','project_estimated_hours',1,
 'assignments',jsonb_build_array(jsonb_build_object('cohort_id',cohort,'is_required',true)))) from manual_ids;
insert into manual_activities select 'optional',learning.save_activity(null,jsonb_build_object('tenant_id',campus,'institution_id',campus,'lesson_id',lesson,
 'activity_type_code','quiz','status_code','published','title','QA Optional Quiz - Must Not Block Completion','max_score',100,'passing_score',60,
 'quiz_max_attempts',1,'is_mandatory',false,'questions',
 '[{"question_text":"Optional practice","question_type":"single_choice","points":1,"position":1,"options":[{"optionText":"Yes","isCorrect":true,"position":1},{"optionText":"No","isCorrect":false,"position":2}]}]'::jsonb,
 'assignments',jsonb_build_array(jsonb_build_object('cohort_id',cohort,'is_required',false)))) from manual_ids;
select jsonb_build_object('purpose','Retained synthetic Modules 7-9 Brave verification; sandbox execution excluded by user',
 'ids',(select to_jsonb(i) from manual_ids i),'activities',(select jsonb_object_agg(kind,payload->>'id') from manual_activities)) manifest;
commit;
