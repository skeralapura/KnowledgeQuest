-- ScienceQuest — Fix compute_topic_score exponential decay loop
--
-- Bug: the original FOREACH loop used array_fill(0, ...) which produces an
-- array of all zeros. In PL/pgSQL FOREACH, the loop variable is overwritten
-- by each array element at the start of every iteration, so `v_i` was always
-- 0. This meant only v_recent[1] (the newest attempt) was ever read, and the
-- confidence was either 0% or 100% depending solely on whether the last
-- answer was correct — ignoring all prior answers.
--
-- Fix: replace FOREACH with a proper integer FOR loop.
-- Also fixes normalisation: divide by sum-of-weights, not count.

create or replace function public.compute_topic_score(
  p_student_id uuid,
  p_topic_id   text
)
returns void
language plpgsql
security definer
as $$
declare
  v_attempts_count integer;
  v_correct_count  integer;
  v_confidence     float;
  v_mastery_status text;
  v_recent         boolean[];
  v_weight         float;
  v_weighted_sum   float := 0;
  v_weight_total   float := 0;
  v_i              integer;
begin
  -- Collect last 8 attempts, newest first
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

  -- Exponential decay: index 1 (newest) gets weight 1.0, each older × 0.8
  for v_i in 1..cardinality(v_recent) loop
    v_weight       := power(0.8, v_i - 1);
    v_weighted_sum := v_weighted_sum + (case when v_recent[v_i] then 1.0 else 0.0 end) * v_weight;
    v_weight_total := v_weight_total + v_weight;
  end loop;

  -- Normalise to 0–100 (divide by sum of weights, not count)
  if v_weight_total > 0 then
    v_confidence := least(100, greatest(0, (v_weighted_sum / v_weight_total) * 100));
  else
    v_confidence := 0;
  end if;

  -- Overall counts (all time, for mastery gate)
  select count(*), coalesce(sum(case when is_correct then 1 else 0 end), 0)
  into v_attempts_count, v_correct_count
  from public.question_attempts
  where student_id = p_student_id
    and topic_id   = p_topic_id;

  -- Current mastery status (to detect review_due regression)
  select mastery_status into v_mastery_status
  from public.topic_scores
  where student_id = p_student_id
    and topic_id   = p_topic_id;

  -- mastered: weighted confidence >= 80 AND >= 5 total attempts
  -- review_due: was mastered but recent confidence dropped below 60
  -- learning: everything else
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
