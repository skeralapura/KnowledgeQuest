-- ScienceQuest — Task 1: Row Level Security
-- Per Section 9 of ScienceQuest_Requirements_v1.1.docx:
--   • All student-owned tables: student_id = auth.uid() for SELECT/INSERT/UPDATE
--   • topics + topic_dependencies: SELECT only, no auth required (publicly readable)
--   • prompt_templates: read-only for authenticated users; write via service role only

-- ─────────────────────────────────────────
-- students
-- ─────────────────────────────────────────
alter table public.students enable row level security;

create policy "students: own row only"
  on public.students
  for all
  using (id = auth.uid());

-- ─────────────────────────────────────────
-- topics — publicly readable, no writes via RLS
-- ─────────────────────────────────────────
alter table public.topics enable row level security;

create policy "topics: public read"
  on public.topics
  for select
  using (true);

-- ─────────────────────────────────────────
-- topic_dependencies — publicly readable, no writes via RLS
-- ─────────────────────────────────────────
alter table public.topic_dependencies enable row level security;

create policy "topic_dependencies: public read"
  on public.topic_dependencies
  for select
  using (true);

-- ─────────────────────────────────────────
-- topic_scores
-- ─────────────────────────────────────────
alter table public.topic_scores enable row level security;

create policy "topic_scores: own rows only"
  on public.topic_scores
  for all
  using (student_id = auth.uid());

-- ─────────────────────────────────────────
-- question_attempts
-- ─────────────────────────────────────────
alter table public.question_attempts enable row level security;

create policy "question_attempts: own rows only"
  on public.question_attempts
  for all
  using (student_id = auth.uid());

-- ─────────────────────────────────────────
-- question_seen
-- ─────────────────────────────────────────
alter table public.question_seen enable row level security;

create policy "question_seen: own rows only"
  on public.question_seen
  for all
  using (student_id = auth.uid());

-- ─────────────────────────────────────────
-- session_events
-- ─────────────────────────────────────────
alter table public.session_events enable row level security;

create policy "session_events: own rows only"
  on public.session_events
  for all
  using (student_id = auth.uid());

-- ─────────────────────────────────────────
-- prompt_templates
--   Authenticated users: SELECT only.
--   INSERT/UPDATE/DELETE: service role only (no RLS policy = blocked for anon/authenticated).
-- ─────────────────────────────────────────
alter table public.prompt_templates enable row level security;

create policy "prompt_templates: authenticated read"
  on public.prompt_templates
  for select
  to authenticated
  using (true);

-- ─────────────────────────────────────────
-- weekly_reports
-- ─────────────────────────────────────────
alter table public.weekly_reports enable row level security;

create policy "weekly_reports: own rows only"
  on public.weekly_reports
  for all
  using (student_id = auth.uid());
