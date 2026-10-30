const { createClient } = require('@supabase/supabase-js');
process.loadEnvFile('.env.local');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
(async () => {
  for (const table of ['project_submissions', 'quiz_attempts']) {
    const result = await db.schema('learning').from(table).select('id, progress:student_activity_progress_id(assignment:activity_assignment_id(cohort_id))').limit(1);
    console.log(JSON.stringify({ table, status: result.status, code: result.error?.code ?? null, message: result.error?.message ?? null, returnedRows: result.data?.length ?? 0 }));
    if (result.error && result.error.code !== '42501') process.exitCode = 1;
  }
})();
