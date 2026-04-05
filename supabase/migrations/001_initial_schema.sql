-- ScienceQuest — Task 1: Initial Schema
-- All 9 tables per Section 9 of ScienceQuest_Requirements_v1.1.docx
-- Zero columns omitted.

-- NOTE: prompt_templates must come before question_attempts due to FK reference.

-- ─────────────────────────────────────────
-- 1. students
-- ─────────────────────────────────────────
create table if not exists public.students (
  id                      uuid        primary key references auth.users(id) on delete cascade,
  name                    text        not null,
  current_grade           integer     not null check (current_grade between 1 and 8),
  interests               text[]      not null default '{}',
  preferred_format        text,
  streak_count            integer     not null default 0,
  streak_freeze_remaining integer     not null default 1,
  last_active_date        date,
  created_at              timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 2. topics
-- ─────────────────────────────────────────
create table if not exists public.topics (
  id               text    primary key,
  standard         text    not null,
  name             text    not null,
  description      text    not null,
  grade            integer not null check (grade between 1 and 8),
  subject          text    not null check (subject in ('math','physics','chemistry','earth_science')),
  diff_min         integer not null check (diff_min between 1 and 10),
  diff_max         integer not null check (diff_max between 1 and 10),
  question_formats text[]  not null default '{}'
);

-- ─────────────────────────────────────────
-- 3. topic_dependencies
-- ─────────────────────────────────────────
create table if not exists public.topic_dependencies (
  id                    uuid primary key default gen_random_uuid(),
  topic_id              text not null references public.topics(id) on delete cascade,
  prerequisite_topic_id text not null references public.topics(id) on delete cascade
);

-- ─────────────────────────────────────────
-- 4. topic_scores
-- ─────────────────────────────────────────
create table if not exists public.topic_scores (
  id               uuid        primary key default gen_random_uuid(),
  student_id       uuid        not null references public.students(id) on delete cascade,
  topic_id         text        not null references public.topics(id) on delete cascade,
  confidence_score float       not null default 0 check (confidence_score between 0 and 100),
  attempts_count   integer     not null default 0,
  correct_count    integer     not null default 0,
  mastery_status   text        not null default 'learning'
                               check (mastery_status in ('learning','mastered','review_due','retained')),
  last_attempted_at timestamptz,
  mastered_at      timestamptz,
  unique (student_id, topic_id)
);

-- ─────────────────────────────────────────
-- 5. prompt_templates  (before question_attempts due to FK)
-- ─────────────────────────────────────────
create table if not exists public.prompt_templates (
  id             integer     primary key generated always as identity,
  topic_id       text        references public.topics(id),
  question_format text,
  template_text  text        not null,
  status         text        not null default 'active'
                             check (status in ('active','challenger','retired')),
  avg_accuracy   float,
  avg_time_ms    float,
  skip_rate      float,
  sample_count   integer     not null default 0,
  ab_group       integer     check (ab_group in (0,1)),
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 6. question_attempts
-- ─────────────────────────────────────────
create table if not exists public.question_attempts (
  id                   uuid        primary key default gen_random_uuid(),
  student_id           uuid        not null references public.students(id) on delete cascade,
  topic_id             text        not null references public.topics(id),
  question_hash        text        not null,
  question_format      text        not null,
  difficulty_delivered integer     not null check (difficulty_delivered between 1 and 10),
  is_correct           boolean     not null,
  time_to_answer_ms    integer,
  reread_count         integer     not null default 0,
  was_skipped          boolean     not null default false,
  scenario_theme       text,
  prompt_template_id   integer     references public.prompt_templates(id),
  created_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 7. question_seen
-- ─────────────────────────────────────────
create table if not exists public.question_seen (
  id               uuid        primary key default gen_random_uuid(),
  student_id       uuid        not null references public.students(id) on delete cascade,
  question_hash    text        not null,
  times_seen       integer     not null default 1,
  last_was_correct boolean     not null,
  last_seen_at     timestamptz not null default now(),
  unique (student_id, question_hash)
);

create index if not exists question_seen_student_hash_idx
  on public.question_seen (student_id, question_hash);

-- ─────────────────────────────────────────
-- 8. session_events
-- ─────────────────────────────────────────
create table if not exists public.session_events (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references public.students(id) on delete cascade,
  session_id   uuid        not null,
  event_type   text        not null
               check (event_type in ('question_shown','answer_submitted','session_quit','streak_extended')),
  event_data   jsonb       not null default '{}',
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 9. weekly_reports
-- ─────────────────────────────────────────
create table if not exists public.weekly_reports (
  id                  uuid        primary key default gen_random_uuid(),
  student_id          uuid        not null references public.students(id) on delete cascade,
  week_start          date        not null,
  topics_attempted    jsonb       not null default '[]',
  topics_mastered     jsonb       not null default '[]',
  struggle_areas      jsonb       not null default '[]',
  overall_accuracy    float,
  total_questions     integer     not null default 0,
  streak_at_week_end  integer     not null default 0,
  generated_at        timestamptz not null default now(),
  unique (student_id, week_start)
);
