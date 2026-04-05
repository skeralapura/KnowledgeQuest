-- Fix compute_weekly_report output shape to match what the report UI expects:
--   overall_accuracy  → stored as decimal 0–1 (not percentage)
--   topics_attempted  → includes topic_name, correct count, mastery_status
--   struggle_areas    → accuracy stored as decimal 0–1

create or replace function public.compute_weekly_report(
  p_student_id uuid,
  p_week_start date
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
  -- Topics attempted this week with topic_name, correct count, mastery_status
  select jsonb_agg(
    jsonb_build_object(
      'topic_id',       sub.topic_id,
      'topic_name',     t.name,
      'attempts',       sub.attempts,
      'correct',        sub.correct,
      'mastery_status', coalesce(ts.mastery_status, 'learning')
    ) order by sub.topic_id
  )
  into v_topics_attempted
  from (
    select
      topic_id,
      count(*)                                              as attempts,
      sum(case when is_correct then 1 else 0 end)          as correct
    from public.question_attempts
    where student_id = p_student_id
      and created_at >= p_week_start
      and created_at <  v_week_end + interval '1 day'
    group by topic_id
  ) sub
  join public.topics t on t.id = sub.topic_id
  left join public.topic_scores ts
    on ts.student_id = p_student_id and ts.topic_id = sub.topic_id;

  v_topics_attempted := coalesce(v_topics_attempted, '[]'::jsonb);

  -- Topics newly mastered this week
  select jsonb_agg(
    jsonb_build_object('topic_id', ts.topic_id, 'topic_name', t.name)
    order by ts.topic_id
  )
  into v_topics_mastered
  from public.topic_scores ts
  join public.topics t on t.id = ts.topic_id
  where ts.student_id  = p_student_id
    and ts.mastered_at >= p_week_start
    and ts.mastered_at <  v_week_end + interval '1 day';

  v_topics_mastered := coalesce(v_topics_mastered, '[]'::jsonb);

  -- Struggle areas: accuracy < 50% this week (min 3 attempts); accuracy as decimal 0–1
  select jsonb_agg(
    jsonb_build_object(
      'topic_id',   sub.topic_id,
      'topic_name', sub.topic_name,
      'accuracy',   round(sub.avg_correct::numeric, 4),
      'attempts',   sub.attempts
    ) order by sub.topic_id
  )
  into v_struggle_areas
  from (
    select
      qa.topic_id,
      t.name                                                as topic_name,
      count(*)                                              as attempts,
      avg(case when qa.is_correct then 1.0 else 0.0 end)   as avg_correct
    from public.question_attempts qa
    join public.topics t on t.id = qa.topic_id
    where qa.student_id = p_student_id
      and qa.created_at >= p_week_start
      and qa.created_at <  v_week_end + interval '1 day'
    group by qa.topic_id, t.name
    having count(*) >= 3
       and avg(case when qa.is_correct then 1.0 else 0.0 end) < 0.5
  ) sub;

  v_struggle_areas := coalesce(v_struggle_areas, '[]'::jsonb);

  -- Overall week stats — accuracy stored as decimal 0–1
  select
    count(*),
    avg(case when is_correct then 1.0 else 0.0 end)
  into v_total_questions, v_overall_accuracy
  from public.question_attempts
  where student_id = p_student_id
    and created_at >= p_week_start
    and created_at <  v_week_end + interval '1 day';

  v_total_questions := coalesce(v_total_questions, 0);

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
