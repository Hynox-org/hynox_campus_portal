/** Database row shapes read from the current schema on 27 October 2026. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export interface DatabaseRows {
  "academic.course_instructors": {
    course_id: string;
    user_id: string;
    instructor_role: string;
    tenant_id: string;
    institution_id: string;
    created_at: string;
  };
  "academic.course_types": {
    id: string;
    code: string;
    description: string | null;
    created_at: string;
  };
  "academic.courses": {
    id: string;
    program_id: string;
    tenant_id: string;
    institution_id: string;
    title: string;
    slug: string;
    description: string | null;
    course_type_id: string | null;
    status_id: string;
    visibility_type_id: string;
    enrollment_mode: string;
    duration_minutes: number | null;
    thumbnail_path: string | null;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    source_template_id: string | null;
  };
  "academic.lesson_resources": {
    id: string;
    lesson_id: string;
    tenant_id: string;
    institution_id: string;
    title: string;
    position: number;
    created_by: string | null;
    created_at: string;
    deleted_at: string | null;
    resource_type_code: string;
    resource_url: string;
    description: string | null;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    file_size: number | null;
    mime_type: string | null;
    is_preview: boolean | null;
    updated_at: string | null;
  };
  "academic.lesson_types": {
    id: string;
    code: string;
    description: string | null;
    created_at: string;
  };
  "academic.lessons": {
    id: string;
    module_id: string;
    tenant_id: string;
    institution_id: string;
    title: string;
    lesson_type_id: string | null;
    content_json: Json | null;
    video_url: string | null;
    duration: number | null;
    position: number;
    is_preview: boolean;
    status_id: string;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "academic.modules": {
    id: string;
    course_id: string;
    tenant_id: string;
    institution_id: string;
    title: string;
    description: string | null;
    position: number;
    status_id: string;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "academic.programs": {
    id: string;
    tenant_id: string;
    institution_id: string;
    title: string;
    slug: string;
    description: string | null;
    status_id: string;
    visibility_type_id: string;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "academic.resource_types": {
    code: string;
    name: string;
    description: string | null;
  };
  "academic.statuses": {
    id: string;
    code: string;
    description: string | null;
    created_at: string;
  };
  "academic.tenant_teachers": {
    tenant_id: string;
    user_id: string;
    created_at: string | null;
  };
  "academic.visibility_types": {
    id: string;
    code: string;
    description: string | null;
    created_at: string;
  };
  "core.audit_logs": {
    id: string;
    tenant_id: string | null;
    event_type: string;
    actor_user_id: string | null;
    target_user_id: string | null;
    metadata: Json | null;
    created_at: string;
  };
  "core.dashboard_revisions": {
    topic: string;
    domain: string;
    revision: number;
  };
  "core.invitation_statuses": {
    code: string;
    description: string | null;
    created_at: string;
  };
  "core.invitation_types": {
    code: string;
    description: string | null;
    created_at: string;
  };
  "core.onboarding_sources": {
    code: string;
    description: string | null;
    created_at: string;
  };
  "core.permissions": {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
  };
  "core.role_permissions": {
    role_id: string;
    permission_id: string;
    created_at: string;
  };
  "core.roles": {
    id: string;
    name: string;
    priority: number;
    description: string | null;
    created_at: string;
  };
  "core.user_invitations": {
    id: string;
    user_id: string;
    tenant_id: string | null;
    token: string;
    invited_by: string | null;
    expires_at: string;
    accepted_at: string | null;
    status: string;
    invitation_type: string;
    created_at: string;
    updated_at: string;
    mail_state: string;
    mail_attempts: number;
    mail_next_attempt_at: string;
    mail_lease: string | null;
    mail_lease_until: string | null;
    mail_message_id: string | null;
  };
  "core.user_roles": {
    user_id: string;
    role_id: string;
    created_at: string;
  };
  "core.user_statuses": {
    code: string;
    description: string | null;
    created_at: string;
  };
  "core.users": {
    id: string;
    auth_user_id: string | null;
    full_name: string | null;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    tenant_id: string | null;
    status: string;
    onboarding_source: string | null;
    deleted_at: string | null;
    deleted_by: string | null;
    delete_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  "delivery.attendance_records": {
    id: string;
    session_id: string;
    student_id: string;
    status: string;
    marked_by: string | null;
    marked_at: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "delivery.attendance_sessions": {
    id: string;
    cohort_id: string;
    session_date: string;
    is_holiday: boolean;
    holiday_name: string | null;
    marked_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "delivery.cohort_statuses": {
    code: string;
    description: string;
  };
  "delivery.cohort_teachers": {
    id: string;
    cohort_id: string;
    teacher_id: string;
    created_at: string;
    updated_at: string;
  };
  "delivery.cohorts": {
    id: string;
    tenant_id: string;
    institution_id: string;
    program_id: string;
    name: string;
    code: string;
    start_date: string | null;
    end_date: string | null;
    status_code: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "delivery.course_assignments": {
    id: string;
    cohort_id: string;
    course_id: string;
    start_date: string | null;
    due_date: string | null;
    is_required: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "delivery.course_progress": {
    id: string;
    user_id: string;
    course_id: string;
    status_code: string;
    completed_lessons: number;
    total_lessons: number;
    progress_percentage: number;
    started_at: string | null;
    completed_at: string | null;
    last_accessed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  "delivery.enrollment_statuses": {
    code: string;
    description: string;
  };
  "delivery.enrollments": {
    id: string;
    user_id: string;
    cohort_id: string;
    status_code: string;
    enrolled_at: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "delivery.lesson_progress": {
    id: string;
    user_id: string;
    lesson_id: string;
    status_code: string;
    progress_percentage: number;
    started_at: string | null;
    completed_at: string | null;
    last_accessed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  "delivery.progress_statuses": {
    code: string;
    description: string;
  };
  "institution.institution_admins": {
    institution_id: string;
    user_id: string;
    assigned_by: string | null;
    assigned_at: string;
    role_scope: string | null;
  };
  "institution.institution_statuses": {
    code: string;
    description: string | null;
    created_at: string;
  };
  "institution.institution_types": {
    code: string;
    description: string | null;
    created_at: string;
  };
  "institution.institutions": {
    id: string;
    name: string;
    institution_code: string;
    institution_type: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
    logo_url: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    created_by: string | null;
  };
  "learning.activities": {
    id: string;
    tenant_id: string;
    institution_id: string;
    lesson_id: string;
    activity_type_code: string;
    status_code: string;
    title: string;
    description: string | null;
    instructions: string | null;
    max_score: number | null;
    passing_score: number | null;
    position: number | null;
    is_mandatory: boolean | null;
    available_from: string | null;
    available_until: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "learning.activity_assignments": {
    id: string;
    activity_id: string;
    cohort_id: string;
    is_required: boolean;
    available_from: string | null;
    available_until: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "learning.activity_statuses": {
    code: string;
    name: string;
    description: string | null;
    created_at: string;
  };
  "learning.activity_types": {
    code: string;
    name: string;
    description: string | null;
    created_at: string;
  };
  "learning.challenge_examples": {
    id: string;
    challenge_id: string;
    example_number: number;
    input_example: string;
    output_example: string;
    explanation: string | null;
    created_at: string;
  };
  "learning.challenge_execution_logs": {
    id: string;
    submission_id: string;
    log_type: string;
    log_message: string | null;
    created_at: string;
  };
  "learning.challenge_execution_queue": {
    id: string;
    submission_id: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
    created_at: string;
  };
  "learning.challenge_starter_templates": {
    id: string;
    challenge_id: string;
    language: string;
    starter_code: string;
    created_at: string;
    updated_at: string;
  };
  "learning.challenge_submission_results": {
    id: string;
    submission_id: string;
    total_test_cases: number | null;
    passed_test_cases: number | null;
    failed_test_cases: number | null;
    execution_time_ms: number | null;
    memory_used_kb: number | null;
    score: number | null;
    result_message: string | null;
    created_at: string;
  };
  "learning.challenge_submission_statuses": {
    code: string;
    description: string;
  };
  "learning.challenge_submissions": {
    id: string;
    challenge_id: string;
    student_id: string;
    student_activity_progress_id: string;
    language: string;
    source_code: string;
    submission_status_code: string;
    submitted_at: string;
    created_at: string;
  };
  "learning.challenge_test_case_results": {
    id: string;
    submission_id: string;
    test_case_id: string;
    passed: boolean | null;
    actual_output: string | null;
    expected_output: string | null;
    execution_time_ms: number | null;
    created_at: string;
  };
  "learning.challenge_test_cases": {
    id: string;
    challenge_id: string;
    input_data: string;
    expected_output: string;
    is_hidden: boolean | null;
    position: number | null;
    created_at: string;
  };
  "learning.newsletter_batches": {
    id: string;
    day: string;
    sections: Json;
    state: string;
    campaign_id: number | null;
    list_id: number | null;
    attempts: number;
    error: string | null;
    created_at: string;
    updated_at: string;
  };
  "learning.newsletter_courses": {
    course_id: string;
    enabled: boolean;
    query: string;
  };
  "learning.newsletter_deliveries": {
    student_id: string;
    day: string;
    batch_id: string;
    email: string;
  };
  "learning.newsletter_editions": {
    course_id: string;
    day: string;
    title: string;
    query: string;
    articles: Json;
    provider: string | null;
    state: string;
    attempts: number;
    error: string | null;
    updated_at: string;
  };
  "learning.newsletter_members": {
    student_id: string | null;
    email: string | null;
    full_name: string | null;
    course_id: string | null;
    title: string | null;
    query: string | null;
  };
  "learning.newsletter_preferences": {
    student_id: string;
    enabled: boolean;
    consent_at: string | null;
    suppressed_reason: string | null;
    last_sent_at: string | null;
    updated_at: string;
    last_considered_at: string | null;
  };
  "learning.newsletter_settings": {
    id: boolean;
    enabled: boolean;
    daily_limit: number;
    credit_reserve: number;
    send_hour: number;
    lease_owner: string | null;
    lease_until: string | null;
    last_run_at: string | null;
    last_error: string | null;
    brevo_folder_id: number | null;
  };
  "learning.programming_challenges": {
    id: string;
    activity_id: string;
    difficulty_level: string;
    problem_statement: string;
    input_format: string | null;
    output_format: string | null;
    constraints_text: string | null;
    starter_code: string | null;
    time_limit_ms: number | null;
    memory_limit_mb: number | null;
    created_at: string;
    updated_at: string;
    strict_mode: boolean;
    max_attempts: number;
  };
  "learning.programming_languages": {
    code: string;
    name: string;
    version: string | null;
    is_active: boolean | null;
    created_at: string;
  };
  "learning.project_reviews": {
    id: string;
    submission_id: string;
    reviewed_by: string;
    score: number | null;
    feedback: string | null;
    review_status: string | null;
    reviewed_at: string | null;
    created_at: string;
  };
  "learning.project_submissions": {
    id: string;
    project_id: string;
    student_id: string;
    student_activity_progress_id: string;
    github_url: string;
    submission_notes: string | null;
    submitted_at: string;
    created_at: string;
    updated_at: string;
  };
  "learning.projects": {
    id: string;
    activity_id: string;
    project_overview: string;
    requirements: string | null;
    deliverables: string | null;
    submission_instructions: string | null;
    difficulty_level: string | null;
    estimated_hours: number | null;
    max_score: number | null;
    created_at: string;
    updated_at: string;
  };
  "learning.quiz_answers": {
    id: string;
    attempt_id: string;
    question_id: string;
    selected_option_id: string | null;
    answer_text: string | null;
    is_correct: boolean | null;
    points_awarded: number | null;
    created_at: string;
  };
  "learning.quiz_attempts": {
    id: string;
    quiz_id: string;
    student_id: string;
    student_activity_progress_id: string;
    attempt_number: number;
    started_at: string;
    submitted_at: string | null;
    score: number | null;
    max_score: number | null;
    passed: boolean | null;
    time_spent_seconds: number | null;
    created_at: string;
    forfeited: boolean;
    forfeit_reason: string | null;
    violation_count: number;
  };
  "learning.quiz_options": {
    id: string;
    question_id: string;
    option_text: string;
    is_correct: boolean | null;
    position: number | null;
    created_at: string;
  };
  "learning.quiz_questions": {
    id: string;
    quiz_id: string;
    question_text: string;
    question_type: string;
    points: number | null;
    position: number | null;
    created_at: string;
    updated_at: string;
  };
  "learning.quizzes": {
    id: string;
    activity_id: string;
    time_limit_minutes: number | null;
    max_attempts: number | null;
    shuffle_questions: boolean | null;
    shuffle_options: boolean | null;
    show_results_immediately: boolean | null;
    created_at: string;
    updated_at: string;
    strict_mode: boolean;
  };
  "learning.resume_scans": {
    id: string;
    student_id: string;
    tenant_id: string | null;
    resume_id: string | null;
    resume_version: number | null;
    label: string;
    fingerprint: string;
    report: Json;
    created_at: string;
  };
  "learning.student_activity_progress": {
    id: string;
    student_id: string;
    activity_id: string;
    activity_assignment_id: string;
    status_code: string;
    score: number | null;
    max_score: number | null;
    attempt_number: number | null;
    started_at: string | null;
    submitted_at: string | null;
    completed_at: string | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
    feedback: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    forfeited: boolean;
    forfeit_reason: string | null;
    violation_count: number;
  };
  "learning.student_activity_statuses": {
    code: string;
    name: string;
    description: string | null;
    created_at: string;
  };
  "learning.student_resumes": {
    id: string;
    student_id: string;
    tenant_id: string | null;
    title: string;
    template: string;
    content: Json;
    version: number;
    created_at: string;
    updated_at: string;
  };
  "library.course_template_tags": {
    course_template_id: string;
    tag_id: string;
  };
  "library.course_templates": {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    category_code: string | null;
    course_type_code: string | null;
    enrollment_mode: string;
    duration_minutes: number | null;
    thumbnail_path: string | null;
    version: number;
    parent_template_id: string | null;
    is_latest: boolean;
    is_published: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "library.lesson_templates": {
    id: string;
    module_template_id: string;
    title: string;
    lesson_type_code: string | null;
    content_json: Json | null;
    video_url: string | null;
    duration: number | null;
    position: number;
    is_preview: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "library.module_templates": {
    id: string;
    course_template_id: string;
    title: string;
    description: string | null;
    position: number;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  "library.resource_templates": {
    id: string;
    lesson_template_id: string;
    resource_type: string;
    title: string;
    file_url: string | null;
    external_url: string | null;
    position: number;
    created_by: string | null;
    created_at: string;
    deleted_at: string | null;
  };
  "library.template_categories": {
    code: string;
    description: string | null;
    created_at: string;
  };
  "library.template_tags": {
    id: string;
    name: string;
    created_at: string;
  };
}
export type Row<Table extends keyof DatabaseRows> = DatabaseRows[Table];

