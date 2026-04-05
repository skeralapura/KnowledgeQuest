-- ScienceQuest — Task 1: Postgres Functions
-- 3 functions per Section 9 of ScienceQuest_Requirements_v1.1.docx

-- ─────────────────────────────────────────
-- 1. compute_topic_score
--    Weighted formula on last 8 attempts.
--    Upserts topic_scores.confidence_score.
--    Called by trigger after every question_attempts INSERT.
--    Single source of truth — never recompute in TypeScript.
-- ─────────────────────────────────────────
create or replace function public.compute_topic_score(
  p_student_id uuid,
  p_topic_id   text
)
returns void
language plpgsql
security definer
as $$
declare
  v_attempts       record;
  v_total          integer := 0;
  v_weighted_sum   float   := 0;
  v_weight         float;
  v_i              integer := 0;
  v_attempts_count integer;
  v_correct_count  integer;
  v_confidence     float;
  v_mastery_status text;
  -- Last 8 attempts, newest first
  v_recent         boolean[];
begin
  -- Collect last 8 attempts (newest first)
  select array_agg(is_correct order by created_at desc)
  into v_recent
  from (
    select is_correct, created_at
    from public.question_attempts
    where student_id = p_student_id
      and topic_id   = p_topic_id
    order by created_at desc
    limit 8
  ) sub;

  if v_recent is null then
    v_recent := '{}';
  end if;

  -- Exponential decay weighting: newest attempt = weight 1.0, each older = × 0.8
  foreach v_i in array array_fill(0, array[cardinality(v_recent)]) loop
    v_weight       := power(0.8, v_i);
    v_weighted_sum := v_weighted_sum + (case when v_recent[v_i + 1] then 1.0 else 0.0 end) * v_weight;
    v_total        := v_total + 1;
    v_i            := v_i + 1;
  end loop;

  -- Normalise to 0–100
  if v_total > 0 then
    v_confidence := least(100, greatest(0, (v_weighted_sum / v_total) * 100));
  else
    v_confidence := 0;
  end if;

  -- Overall counts
  select count(*), coalesce(sum(case when is_correct then 1 else 0 end), 0)
  into v_attempts_count, v_correct_count
  from public.question_attempts
  where student_id = p_student_id
    and topic_id   = p_topic_id;

  -- Mastery status
  -- mastered: confidence >= 80 AND >= 5 attempts
  -- review_due: previously mastered but confidence dropped below 60
  -- retained: mastered AND confidence still >= 80 (re-checked after cooldown — Phase 2)
  -- learning: everything else
  select mastery_status into v_mastery_status
  from public.topic_scores
  where student_id = p_student_id
    and topic_id   = p_topic_id;

  if v_confidence >= 80 and v_attempts_count >= 5 then
    v_mastery_status := 'mastered';
  elsif v_mastery_status = 'mastered' and v_confidence < 60 then
    v_mastery_status := 'review_due';
  elsif v_mastery_status is null then
    v_mastery_status := 'learning';
  end if;

  -- Upsert topic_scores
  insert into public.topic_scores (
    student_id, topic_id, confidence_score, attempts_count, correct_count,
    mastery_status, last_attempted_at, mastered_at
  )
  values (
    p_student_id,
    p_topic_id,
    v_confidence,
    v_attempts_count,
    v_correct_count,
    v_mastery_status,
    now(),
    case when v_mastery_status = 'mastered' then coalesce(
      (select mastered_at from public.topic_scores
       where student_id = p_student_id and topic_id = p_topic_id),
      now()
    ) else null end
  )
  on conflict (student_id, topic_id) do update set
    confidence_score  = excluded.confidence_score,
    attempts_count    = excluded.attempts_count,
    correct_count     = excluded.correct_count,
    mastery_status    = excluded.mastery_status,
    last_attempted_at = excluded.last_attempted_at,
    mastered_at       = case
      when excluded.mastery_status = 'mastered' and topic_scores.mastered_at is null
        then now()
      else topic_scores.mastered_at
    end;
end;
$$;

-- Trigger: call compute_topic_score after every question_attempts INSERT
create or replace function public._trigger_compute_topic_score()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.compute_topic_score(NEW.student_id, NEW.topic_id);
  return NEW;
end;
$$;

drop trigger if exists trg_compute_topic_score on public.question_attempts;
create trigger trg_compute_topic_score
  after insert on public.question_attempts
  for each row execute function public._trigger_compute_topic_score();


-- ─────────────────────────────────────────
-- 2. upsert_question_seen
--    Atomically increments times_seen, updates last_was_correct and last_seen_at.
--    Called after every question submission.
-- ─────────────────────────────────────────
create or replace function public.upsert_question_seen(
  p_student_id  uuid,
  p_hash        text,
  p_was_correct boolean
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.question_seen (student_id, question_hash, times_seen, last_was_correct, last_seen_at)
  values (p_student_id, p_hash, 1, p_was_correct, now())
  on conflict (student_id, question_hash) do update set
    times_seen       = question_seen.times_seen + 1,
    last_was_correct = excluded.last_was_correct,
    last_seen_at     = now();
end;
$$;


-- ─────────────────────────────────────────
-- 3. compute_weekly_report
--    Aggregates attempts for a given week and upserts a weekly_reports row.
--    Called by Sunday cron job (Supabase scheduled edge function).
-- ─────────────────────────────────────────
create or replace function public.compute_weekly_report(
  p_student_id uuid,
  p_week_start date        -- Must be a Monday
)
returns void
language plpgsql
security definer
as $$
declare
  v_week_end          date    := p_week_start + interval '6 days';
  v_total_questions   integer;
  v_overall_accuracy  float;
  v_streak_end        integer;
  v_topics_attempted  jsonb;
  v_topics_mastered   jsonb;
  v_struggle_areas    jsonb;
begin
  -- Topics attempted this week with per-topic accuracy
  select jsonb_agg(
    jsonb_build_object(
      'topic_id', topic_id,
      'attempts', count(*),
      'accuracy', round(avg(case when is_correct then 1.0 else 0.0 end) * 100, 1)
    ) order by topic_id
  )
  into v_topics_attempted
  from public.question_attempts
  where student_id = p_student_id
    and created_at >= p_week_start
    and created_at <  v_week_end + interval '1 day';

  v_topics_attempted := coalesce(v_topics_attempted, '[]'::jsonb);

  -- Topics newly mastered this week
  select jsonb_agg(topic_id order by topic_id)
  into v_topics_mastered
  from public.topic_scores
  where student_id  = p_student_id
    and mastered_at >= p_week_start
    and mastered_at <  v_week_end + interval '1 day';

  v_topics_mastered := coalesce(v_topics_mastered, '[]'::jsonb);

  -- Struggle areas: topics with accuracy < 50% this week (min 3 attempts)
  select jsonb_agg(
    jsonb_build_object(
      'topic_id',     topic_id,
      'avg_accuracy', round(avg(case when is_correct then 1.0 else 0.0 end) * 100, 1),
      'note',         'Needs more practice'
    ) order by topic_id
  )
  into v_struggle_areas
  from public.question_attempts
  where student_id = p_student_id
    and created_at >= p_week_start
    and created_at <  v_week_end + interval '1 day'
  group by topic_id
  having count(*) >= 3
     and avg(case when is_correct then 1.0 else 0.0 end) < 0.5;

  v_struggle_areas := coalesce(v_struggle_areas, '[]'::jsonb);

  -- Overall week stats
  select
    count(*),
    round(avg(case when is_correct then 1.0 else 0.0 end) * 100, 1)
  into v_total_questions, v_overall_accuracy
  from public.question_attempts
  where student_id = p_student_id
    and created_at >= p_week_start
    and created_at <  v_week_end + interval '1 day';

  v_total_questions  := coalesce(v_total_questions, 0);

  -- Streak at end of week
  select streak_count into v_streak_end
  from public.students
  where id = p_student_id;

  v_streak_end := coalesce(v_streak_end, 0);

  -- Upsert weekly_reports
  insert into public.weekly_reports (
    student_id, week_start, topics_attempted, topics_mastered,
    struggle_areas, overall_accuracy, total_questions, streak_at_week_end, generated_at
  )
  values (
    p_student_id, p_week_start, v_topics_attempted, v_topics_mastered,
    v_struggle_areas, v_overall_accuracy, v_total_questions, v_streak_end, now()
  )
  on conflict (student_id, week_start) do update set
    topics_attempted   = excluded.topics_attempted,
    topics_mastered    = excluded.topics_mastered,
    struggle_areas     = excluded.struggle_areas,
    overall_accuracy   = excluded.overall_accuracy,
    total_questions    = excluded.total_questions,
    streak_at_week_end = excluded.streak_at_week_end,
    generated_at       = now();
end;
$$;
