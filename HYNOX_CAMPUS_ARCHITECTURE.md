# Hynox Campus Technical Architecture & Product Documentation Handbook
*Official Technical Specification and System Topology Manual*

---

## CHAPTER 1 — PLATFORM OVERVIEW

### 1.1 What is Hynox Campus?
**Hynox Campus** is an enterprise-grade multi-tenant educational portal designed to bridge physical classroom instruction with hands-on labs, automated assignment validation, and industry-aligned placement readiness. 

### 1.2 Vision & Business Goal
The primary objective of Hynox Campus is to raise student job-readiness by linking theoretical academic milestones to verifiable coding outputs ("proof-of-work"). From a business standpoint, Hynox Campus operates as a B2B SaaS platform that institutions (colleges, schools, vocational centers) purchase to manage, track, and accelerate their students' progress.

### 1.3 Multi-Tenant Architecture & Institution-Based Learning Model
Hynox Campus employs a strict multi-tenant isolation pattern using a Tenant ID. The system contains distinct schemas to segregate database domains, ensuring:
- **Data Privacy:** One institution cannot query or view another institution's data.
- **Content Reusability:** Master content templates can be safely duplicated into institution-specific courses.
- **Auditing & Governance:** Complete tracking of user and admin actions within each tenant.

### 1.4 Hierarchical Content Delivery Structure
The hierarchy follows a strict parent-child relationship cascading down from the Super Admin to the individual learning activities:

```mermaid
graph TD
    SuperAdmin["Super Admin (Platform Owner)"]
    ↓↓
    Institution["Institution (Tenant)"]
    ↓↓
    Programs["Programs (Degree Tracks)"]
    ↓↓
    Courses["Courses (e.g., Data Structures)"]
    ↓↓
    Modules["Modules (Chapters)"]
    ↓↓
    Lessons["Lessons (Lectures/Topics)"]
    ↓↓
    LearningActivities["Learning Activities (Quizzes, Projects, Challenges)"]

    style SuperAdmin fill:#0F172A,stroke:#2563EB,stroke-width:2px,color:#FFFFFF
    style Institution fill:#0F172A,stroke:#06B6D4,stroke-width:2px,color:#FFFFFF
    style Programs fill:#1E293B,stroke:#E2E8F0,stroke-width:1px,color:#FFFFFF
    style Courses fill:#1E293B,stroke:#E2E8F0,stroke-width:1px,color:#FFFFFF
    style Modules fill:#1E293B,stroke:#E2E8F0,stroke-width:1px,color:#FFFFFF
    style Lessons fill:#1E293B,stroke:#E2E8F0,stroke-width:1px,color:#FFFFFF
    style LearningActivities fill:#2563EB,stroke:#06B6D4,stroke-width:2px,color:#FFFFFF
```

---

## CHAPTER 2 — COMPLETE SYSTEM ARCHITECTURE

Hynox Campus is organized into six major functional domains to split responsibilities, secure multi-tenant boundaries, and scale learning workloads:

1. **Core:** Manages identity, RBAC (Role-Based Access Control), audit logging, and core profiles.
2. **Institution:** Models physical schools/colleges, administrative configurations, and status indicators.
3. **Library:** Operates as a master template library, holding decoupled reusable educational materials.
4. **Academic:** Stores the localized tenant-specific curriculum mapping programs, courses, modules, and lessons.
5. **Delivery:** Operates the live instruction plane, defining cohorts, student enrollments, course assignments, and lesson completion trackers.
6. **Learning:** Orchestrates hands-on evaluation workflows, containing activities (Quizzes, Projects, and Programming Challenges).

### 2.1 Domain-Level Architecture Flow

```mermaid
flowchart LR
    subgraph CoreDomain [Core]
        direction TB
        Users[users] --> Roles[user_roles]
    end

    subgraph InstitutionDomain [Institution]
        direction TB
        Tenant[institutions] --> Admins[institution_admins]
    end

    subgraph LibraryDomain [Library]
        direction TB
        Master[Master Templates]
    end

    subgraph AcademicDomain [Academic]
        direction TB
        Prog[programs] --> Crs[courses] --> Mod[modules] --> Les[lessons]
    end

    subgraph DeliveryDomain [Delivery]
        direction TB
        Coh[cohorts] --> Enr[enrollments] --> ProgTr[course_progress]
    end

    subgraph LearningDomain [Learning]
        direction TB
        Act[activities] --> Sub[submissions/attempts]
    end

    Tenant -.-> CoreDomain
    Master --"Duplication Flow"--> AcademicDomain
    AcademicDomain --"Assigned to"--> DeliveryDomain
    DeliveryDomain --"Triggers Tracker"--> LearningDomain
```

---

## CHAPTER 3 — CORE SCHEMA

The `core` schema handles security boundaries, authorization, audit tracks, and account onboarding.

### 3.1 Core Schema Table Definitions

#### `core.users`
* **Purpose:** Represents consolidated user profiles matching identity providers.
* **Columns:**
  - `id` (`UUID`, PK): Unique identifier.
  - `auth_user_id` (`UUID`, FK -> `auth.users.id`): References Supabase auth system.
  - `full_name` (`TEXT`): User's legal name.
  - `email` (`TEXT`, Unique): Primary registration email.
  - `tenant_id` (`UUID`, FK -> `institution.institutions.id`): Active tenant membership.
  - `status` (`TEXT`, FK -> `core.user_statuses.code`): E.g., `active`, `invited`.
  - `deleted_at` (`TIMESTAMPTZ`): Soft-delete indicator.

#### `core.roles`
* **Purpose:** Roles used to assign capabilities.
* **Seed Values:** `super_admin` (Priority 100), `institution_admin` (Priority 80), `trainer` (Priority 60), `student` (Priority 10), `public` (Priority 0).

#### `core.user_roles`
* **Purpose:** Junction table mapping users to roles.
* **Columns:** `user_id` (`UUID`, FK), `role_id` (`UUID`, FK).

#### `core.permissions`
* **Purpose:** Granular system permission strings (e.g., `course:create`, `submission:review`).

#### `core.role_permissions`
* **Purpose:** Mappings of permissions to roles.

#### `core.user_invitations`
* **Purpose:** Manages secure onboarding links generated for bulk-provisioned students.
* **Columns:** `id`, `user_id`, `token` (`UUID`), `expires_at`, `status` (`created`, `sent`, `accepted`, `expired`), `invitation_type`.

#### `core.audit_logs`
* **Purpose:** Immutable audit record of critical actions.
* **Columns:** `id`, `tenant_id`, `event_type` (e.g., `invitation_accepted`), `actor_user_id`, `metadata` (`JSONB`).

### 3.2 Core ER Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        uuid auth_user_id
        text full_name
        text email UK
        uuid tenant_id FK
        text status FK
    }
    ROLES {
        uuid id PK
        text name UK
        integer priority
    }
    USER_ROLES {
        uuid user_id PK, FK
        uuid role_id PK, FK
    }
    PERMISSIONS {
        uuid id PK
        text name UK
    }
    ROLE_PERMISSIONS {
        uuid role_id PK, FK
        uuid permission_id PK, FK
    }
    USER_INVITATIONS {
        uuid id PK
        uuid user_id FK
        uuid token UK
        timestamptz expires_at
        text status
    }
    AUDIT_LOGS {
        uuid id PK
        uuid tenant_id FK
        text event_type
        uuid actor_user_id FK
        jsonb metadata
    }

    USERS ||--o{ USER_ROLES : "has"
    ROLES ||--o{ USER_ROLES : "assigned"
    ROLES ||--o{ ROLE_PERMISSIONS : "owns"
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "linked"
    USERS ||--o{ USER_INVITATIONS : "targets"
    USERS ||--o{ AUDIT_LOGS : "causes"
```

---

## CHAPTER 4 — INSTITUTION SCHEMA

The `institution` schema encapsulates tenant metadata, campus administrators, and operational state mappings.

### 4.1 Schema Tables
* **`institution.institutions`:** Stores the organization name, unique code (e.g., `VIT-CH`), subdomain slug, and address.
* **`institution.institution_admins`:** Mapping table associating institution administrators to specific institutions.
* **`institution.institution_types`:** Lookup table (e.g., `school`, `college`, `university`, `training_center`, `corporate_partner`).
* **`institution.institution_statuses`:** Lookup table (e.g., `active`, `inactive`, `suspended`, `onboarding`).

### 4.2 Institution Onboarding Workflow

```mermaid
flowchart TD
    SA["Super Admin Initiates"]
    --> CreateInst["Create Institution Record (Status: onboarding)"]
    --> CreateAdmin["Create Institution Admin Profile"]
    --> InviteEmail["Dispatch Onboarding Invitation Email"]
    --> AdminVerify["Admin Verifies & Logs in via Magic Link"]
    --> Activate["Set Institution Status to 'active' & User to 'active'"]

    style SA fill:#0F172A,stroke:#2563EB,stroke-width:2px,color:#FFFFFF
    style Activate fill:#16A34A,stroke:#16A34A,stroke-width:2px,color:#FFFFFF
```

---

## CHAPTER 5 — LIBRARY SCHEMA

The `library` schema acts as a **Global Reusable Master Content Library**. Decoupled from any physical tenant, it holds master templates of courses and lessons curated by subject matter experts.

### 5.1 Tables
- **`library.course_templates`:** Blueprint for courses containing standard descriptions, learning objectives, and categories.
- **`library.module_templates`:** Blueprint for modules.
- **`library.lesson_templates`:** Blueprint for lessons (video placeholders, texts).
- **`library.resource_templates`:** Decoupled PDFs, cheatsheets, and files.
- **`library.template_categories` & `template_tags`:** Mappings for categorization.

### 5.2 Template Versioning
Every master template contains a `version` indicator (e.g., `v1.2.0`). When updates are made to a master template, the version increments. Localized copies inside `academic.courses` store the template ID and version they duplicated from to track drift.

```mermaid
classDiagram
    class CourseTemplate {
        +UUID id
        +String title
        +String code
        +String version
        +JSONB metadata
    }
    class ModuleTemplate {
        +UUID id
        +UUID course_template_id
        +String title
        +Integer position
    }
    class LessonTemplate {
        +UUID id
        +UUID module_template_id
        +String title
        +String lesson_type
    }
    class ResourceTemplate {
        +UUID id
        +UUID lesson_template_id
        +String resource_type
        +String file_url
    }

    CourseTemplate "1" *-- "many" ModuleTemplate
    ModuleTemplate "1" *-- "many" LessonTemplate
    LessonTemplate "1" *-- "many" ResourceTemplate
```

---

## CHAPTER 6 — LIBRARY → ACADEMIC DUPLICATION FLOW

When an institution purchases a course program, the library templates are cloned (deep-copied) into the `academic` schema. This creates localized copies that trainers can modify without affecting the master template.

```mermaid
flowchart TD
    subgraph LibrarySchema [Library Master Templates]
        CourseT[Course Template] --> ModT[Module Template] --> LesT[Lesson Template] --> ResT[Resource Template]
    end

    subgraph AcademicSchema [Academic Localized Instances]
        Program[Tenant Program] --> CourseA[Course] --> ModA[Module] --> LesA[Lesson] --> ResA[Lesson Resource]
    end

    CourseT -- "Deep Copy (Clone)" --> CourseA
    ModT -- "Deep Copy (Clone)" --> ModA
    LesT -- "Deep Copy (Clone)" --> LesA
    ResT -- "Deep Copy (Clone)" --> ResA
    Program -- "Parent Anchor" --> CourseA
```

### Duplication Rules:
1. Relationships are preserved via matching foreign keys.
2. Tenant ID and Institution ID are written into all cloned tables.
3. Templates are assigned unique UUIDs on cloning to avoid collision.

---

## CHAPTER 7 — ACADEMIC SCHEMA

The `academic` schema contains the curriculum outline mapped to the institution's tenant scope.

### 7.1 Table Definitions
* **`academic.programs`:** High-level degree or track (e.g., "B.Tech Computer Science V1").
* **`academic.courses`:** A course associated with a program (e.g., "Full-Stack Web Development").
* **`academic.course_instructors`:** Junction mapping trainers to courses.
* **`academic.modules`:** Chapters within a course.
* **`academic.lessons`:** Lectures, labs, or assignments.
* **`academic.lesson_resources`:** Supporting materials like videos, slide PDFs, and markdown sheets.

### 7.2 Academic ERD

```mermaid
erDiagram
    PROGRAMS ||--o{ COURSES : "contains"
    COURSES ||--o{ COURSE_INSTRUCTORS : "instructed_by"
    COURSES ||--o{ MODULES : "splits_into"
    MODULES ||--o{ LESSONS : "houses"
    LESSONS ||--o{ LESSON_RESOURCES : "has"

    PROGRAMS {
        uuid id PK
        uuid tenant_id FK
        text title
        slug slug
    }
    COURSES {
        uuid id PK
        uuid program_id FK
        text title
        text enrollment_mode
    }
    COURSE_INSTRUCTORS {
        uuid course_id PK, FK
        uuid user_id PK, FK
        text instructor_role
    }
    MODULES {
        uuid id PK
        uuid course_id FK
        text title
        integer position
    }
    LESSONS {
        uuid id PK
        uuid module_id FK
        text title
        text video_url
    }
    LESSON_RESOURCES {
        uuid id PK
        uuid lesson_id FK
        text resource_type
        text file_url
    }
```

---

## CHAPTER 8 — DELIVERY SCHEMA

The `delivery` schema manages live deployment. It converts the academic curriculum outline into an active cohort-based delivery plane for students.

```mermaid
flowchart TD
    Prog[Academic Program]
    --> Cohort["Cohort (e.g., CS-2026-Batch-A)"]
    --> Enroll["Enroll Student"]
    --> CourseAssign["Assign Course to Cohort"]
    --> Progress["Track Progress (course_progress & lesson_progress)"]
```

### 8.1 Schema Tables
- **`delivery.cohorts`:** Groups of students traversing a program at the same time.
- **`delivery.enrollments`:** Maps students to a cohort.
- **`delivery.course_assignments`:** Determines when a course goes live for a cohort.
- **`delivery.lesson_progress`:** Tracking table recording if a lesson is `not_started`, `in_progress`, or `completed`.
- **`delivery.course_progress`:** Aggregate progress tracker calculated from lesson completions.

---

## CHAPTER 9 — LEARNING SCHEMA

The `learning` schema orchestrates student evaluation actions. It decouples activities from the academic lessons structure to support multiple homework types.

### 9.1 Activity Hierarchy and Decoupling
An `activity` record represents a wrapper for an assessment. It contains a FK link to a lesson. The details of the activity reside in its specific sub-table based on the type:

```mermaid
classDiagram
    class Activity {
        +UUID id
        +UUID lesson_id
        +String activity_type_code
        +String title
        +Integer max_score
        +Boolean is_mandatory
    }
    class Quiz {
        +UUID id
        +UUID activity_id
        +Integer time_limit_minutes
    }
    class Project {
        +UUID id
        +UUID activity_id
        +String project_overview
    }
    class ProgrammingChallenge {
        +UUID id
        +UUID activity_id
        +String difficulty_level
    }

    Activity <|-- Quiz : extension
    Activity <|-- Project : extension
    Activity <|-- ProgrammingChallenge : extension
```

- **`learning.activities`:** Parent wrapper defining title, scoring limits, and schedules.
- **`learning.activity_assignments`:** Maps activities to cohorts.
- **`learning.student_activity_progress`:** Real-time state tracker (points scored, completion status).

---

## CHAPTER 10 — QUIZ SYSTEM

Quizzes provide instant automated knowledge validation.

### 10.1 Table Outlines
- **`learning.quizzes`:** Holds settings like time limits, shuffle settings, and maximum attempts.
- **`learning.quiz_questions`:** Questions linked to a quiz (types: `single_choice`, `multiple_choice`, `true_false`, `short_answer`).
- **`learning.quiz_options`:** Answer options for choice questions.
- **`learning.quiz_attempts`:** Records student submissions and scores.
- **`learning.quiz_answers`:** Selected answers submitted during an attempt.

### 10.2 Quiz Workflow

```mermaid
sequenceDiagram
    autonumber
    Student->>Platform: Open Quiz & Create Attempt
    Platform->>Database: Insert record in quiz_attempts
    Student->>Platform: Submit answers
    Platform->>Platform: Run Auto-Evaluation matching options.is_correct
    Platform->>Database: Write score to quiz_attempts & update student_activity_progress
    Platform->>Student: Present results (Score & Explanations)
```

---

## CHAPTER 11 — PROJECT SYSTEM

Projects evaluate larger practical development assignments, utilizing peer, trainer, or Git check verification steps.

### 11.1 Tables
- **`learning.projects`:** Contains the requirements, deliverables, templates, and instructions.
- **`learning.project_submissions`:** Student's submission record (stores GitHub repo link, deployment live URL, and student notes).
- **`learning.project_reviews`:** Review records containing score, feedback text, and status (`pending`, `approved`, `rejected`, `revision_requested`).

### 11.2 Project Submission Workflow

```mermaid
flowchart TD
    Student["Student builds project & pushes to GitHub"]
    --> Submit["Submit GitHub URL + Demo URL"]
    --> VerifyGit["Platform checks Git Repository Visibility"]
    --> ReviewQueue["Placed in Trainer Review Queue"]
    --> TrainerGrade["Trainer Reviews Code & Logs Score"]
    --> Completed["Result Published to Student Dashboard"]
```

---

## CHAPTER 12 — PROGRAMMING CHALLENGE SYSTEM

This acts as a LeetCode-style evaluation engine, where code submitted by a student is executed against test cases in an isolated environment.

### 12.1 Tables
- **`learning.programming_challenges`:** Problem description, starter template code, and run limits (time/memory).
- **`learning.challenge_examples`:** Sample inputs and outputs shown to the student.
- **`learning.challenge_test_cases`:** Inputs and expected outputs (includes hidden test cases used for final grading).
- **`learning.challenge_submissions`:** Stores the submitted code, language (`javascript`, `python`, etc.), and status.
- **`learning.challenge_submission_results`:** Grading totals (test cases passed/failed, run time, and points scored).
- **`learning.challenge_test_case_results`:** Performance metrics on individual test cases.
- **`learning.challenge_execution_queue`:** Queue entry managing execution scheduling.
- **`learning.challenge_execution_logs`:** Compiling and runtime errors.

### 12.2 Challenge Evaluation Flow

```mermaid
flowchart TD
    Student["Student Submits Code"]
    --> Queue["Insert into challenge_execution_queue"]
    --> Worker["Judge Worker pulls task"]
    --> Sandbox["Compile & Run inside Secure Sandbox"]
    --> TestEval["Evaluate outputs against challenge_test_cases"]
    --> DBResults["Write to challenge_submission_results & test_case_results"]
    --> Dequeue["Mark Queue item 'completed'"]
    --> StudentUI["Update UI (status: accepted | wrong_answer | runtime_error)"]
```

---

## CHAPTER 13 — JUDGE ENGINE ARCHITECTURE

The Judge Engine executes untrusted student code safely, asynchronously, and accurately.

```mermaid
graph TD
    Sub["Student Code Submission"]
    --> Queue["challenge_execution_queue"]
    --> Worker["Judge Worker"]
    --> Sandbox["Secure Sandbox (Docker Container Isolation)"]
    --> Run["Run Code (Limits: 1000ms, 256MB)"]
    --> Compare["Compare stdout with expected_output"]
    --> Result["Calculate Score & Write Results"]
```

### 13.1 Key Architectural Components
1. **The Queue:** Uses `challenge_execution_queue` table rows as a message broker. Employs Postgres transactional locking (`SELECT ... FOR UPDATE SKIP LOCKED`) to coordinate multiple concurrent judge workers.
2. **The Sandbox:** Code executes inside isolated Docker containers. Network access is disabled to prevent database leaks or scraping.
3. **Execution Limits:** Execution terminates if it exceeds `time_limit_ms` (Time Limit Exceeded) or `memory_limit_mb` (Memory Limit Exceeded).
4. **Result Processing:** Results are compiled and updated in the database, triggering triggers that refresh the student's progress and career score metrics.

---

## CHAPTER 14 — DASHBOARD ARCHITECTURE

Hynox Campus implements isolated, focused workspaces customized to four user personas:

### 14.1 Persona Access Flows

```mermaid
graph TD
    Login["User Logs In"]
    --> Resolver{"Resolve User Role"}

    Resolver -- "super_admin" --> SuperAdmin["Super Admin Dashboard"]
    Resolver -- "institution_admin" --> InstAdmin["Institution Admin Dashboard"]
    Resolver -- "trainer" --> TrainerDashboard["Trainer Dashboard"]
    Resolver -- "student" --> StudentDashboard["Student Dashboard"]

    style SuperAdmin fill:#0F172A,stroke:#2563EB,stroke-width:2px,color:#FFFFFF
    style InstAdmin fill:#0F172A,stroke:#06B6D4,stroke-width:2px,color:#FFFFFF
    style TrainerDashboard fill:#1E293B,stroke:#E2E8F0,stroke-width:1px,color:#FFFFFF
    style StudentDashboard fill:#2563EB,stroke:#06B6D4,stroke-width:2px,color:#FFFFFF
```

### 14.2 Dashboard Modules
- **Super Admin Dashboard:** Manage institutions, review system audit logs, and deploy global courses to the master Library.
- **Institution Admin Dashboard:** Provision trainers, create cohorts, import student spreadsheets, and track overall department placements.
- **Trainer Dashboard:** Review student github submissions, add learning activities (Quizzes/Projects), and view student progress.
- **Student Dashboard:** Course roadmaps, code playground, resume builder, placement prep utilities, and public portfolio.

---

## CHAPTER 15 — STUDENT JOURNEY

```mermaid
flowchart TD
    Invite["Receive Onboarding Invitation Link"]
    --> Register["Activate Profile & Setup Passwordless Login"]
    --> Access["Access Assigned Courses & Videos"]
    --> Study["Consume Theory & Study Materials"]
    --> Quiz["Pass Lesson Quizzes"]
    --> Project["Submit GitHub Repo for Review"]
    --> Challenge["Solve Programming Challenges"]
    --> Resume["Build Profile & Generate ATS Resume"]
    --> Placement["Unlock Proof of Work Portfolio for Recruiters"]
```

---

## CHAPTER 16 — TRAINER JOURNEY

```mermaid
flowchart TD
    Crs["Create or Customize Course Curriculum"]
    --> Act["Define Quizzes & Programming Challenges"]
    --> Cohort["Assign Course to Cohort"]
    --> Track["Monitor Attendance and Streaks"]
    --> Review["Grade Projects & Provide Inline Feedback"]
    --> Placement["Recommend High-Performing Students to Placement Cell"]
```

---

## CHAPTER 17 — ADMIN JOURNEY

```mermaid
flowchart TD
    Setup["Configure Institution Details & Logo"]
    --> Provision["Invite Trainers"]
    --> BulkImport["Upload Student Spreadsheet (Bulk Provisioning)"]
    --> Cohort["Create Cohorts & Map Academic Programs"]
    --> Reports["Monitor Leaderboards & Placement Metrics"]
```

---

## CHAPTER 18 — ROLE-BASED ACCESS MATRIX

Access is controlled via permissions mapped to user roles in `core.role_permissions`.

| Permission / Functionality | Super Admin | Institution Admin | Trainer / Teacher | Student |
| :--- | :---: | :---: | :---: | :---: |
| **Manage Institutions** | ✅ | ❌ | ❌ | ❌ |
| **System-wide Audit Logs** | ✅ | ❌ | ❌ | ❌ |
| **Publish Master Templates** | ✅ | ❌ | ❌ | ❌ |
| **Provision Users & Trainers** | ✅ | ✅ | ❌ | ❌ |
| **Configure Cohorts** | ✅ | ✅ | ❌ | ❌ |
| **Edit Localized Courses** | ✅ | ✅ | ✅ | ❌ |
| **Grade Submissions** | ❌ | ❌ | ✅ | ❌ |
| **Attempt Quizzes & Labs** | ❌ | ❌ | ❌ | ✅ |
| **Build Resumes** | ❌ | ❌ | ❌ | ✅ |

---

## CHAPTER 19 — DATABASE RELATIONSHIP DIAGRAMS

The relationships between schemas are mapped below to show how foreign key constraints maintain data integrity:

### 19.1 Core & Institution Relationships
```mermaid
erDiagram
    institution_institutions ||--o{ core_users : "groups"
    core_users ||--o{ institution_institution_admins : "acts_as"
    institution_institutions ||--o{ institution_institution_admins : "managed_by"

    core_users {
        UUID id
        UUID tenant_id FK
    }
    institution_institutions {
        UUID id
        TEXT name
    }
    institution_institution_admins {
        UUID institution_id FK
        UUID user_id FK
    }
```

### 19.2 Academic, Delivery & Learning Connectors
```mermaid
erDiagram
    academic_lessons ||--o{ learning_activities : "evaluates"
    delivery_cohorts ||--o{ delivery_enrollments : "has"
    core_users ||--o{ delivery_enrollments : "participates"
    learning_activities ||--o{ learning_activity_assignments : "assigned_to"
    delivery_cohorts ||--o{ learning_activity_assignments : "targets"
    delivery_enrollments ||--o{ learning_student_activity_progress : "tracks"

    learning_activities {
        UUID id
        UUID lesson_id FK
    }
    learning_activity_assignments {
        UUID activity_id FK
        UUID cohort_id FK
    }
```

---

## CHAPTER 20 — COMPLETE DATA FLOW

The diagram below details how data flows end-to-end through the platform—from initial tenant onboarding to master content duplication, active student completion, and placement dispatch:

```mermaid
flowchart TD
    subgraph OnboardingPhase [1. Onboarding Phase]
        Inst[Create Institution] --> Admin[Assign Inst Admin] --> Students[Import Student List]
    end

    subgraph ContentPhase [2. Content Phase]
        Library[Master Template Library] -- "Duplicates to" --> Curriculum[Academic Curriculum]
    end

    subgraph InstructionPhase [3. Instruction Phase]
        Curriculum -- "Assigned to" --> Cohort[Active Cohort]
        Students -- "Enrolled in" --> Cohort
    end

    subgraph EvaluationPhase [4. Evaluation Phase]
        Cohort --> Quiz[Auto-Evaluated Quizzes]
        Cohort --> Lab[Judge-Engine Coding Challenges]
        Cohort --> Project[Trainer-Reviewed Projects]
    end

    subgraph CompletionPhase [5. Placement Phase]
        Quiz & Lab & Project --> Progress[Real-time Student Progress Tracker]
        Progress --> CareerScore[Verify Achievements & Update ATS Resume]
        CareerScore --> Showcase[Public Portfolio & Recruiter Leaderboard]
    end
    
    style OnboardingPhase fill:#1E293B,color:#FFFFFF
    style ContentPhase fill:#1E293B,color:#FFFFFF
    style InstructionPhase fill:#1E293B,color:#FFFFFF
    style EvaluationPhase fill:#1E293B,color:#FFFFFF
    style CompletionPhase fill:#0F172A,stroke:#16A34A,stroke-width:2px,color:#FFFFFF
```
