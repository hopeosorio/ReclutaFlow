-- get_best_recruiter_for_slots.sql
-- Function to find the most available recruiter, excluding those already busy with interviews or provisional slots.

CREATE OR REPLACE FUNCTION public.get_best_recruiter_for_slots(
  p_slot1 timestamptz DEFAULT NULL,
  p_slot2 timestamptz DEFAULT NULL,
  p_slot3 timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_1_start timestamptz;
  v_slot_2_start timestamptz;
  v_slot_3_start timestamptz;
  v_recruiter_id uuid;
BEGIN
  -- Normalize inputs to hourly boundaries
  v_slot_1_start := date_trunc('hour', p_slot1);
  v_slot_2_start := date_trunc('hour', p_slot2);
  v_slot_3_start := date_trunc('hour', p_slot3);

  -- We want the recruiter from those with 'rh_recruiter' role (like César and Ana)
  -- that is LEAST busy overall today and is NOT busy in the specific slots requested.
  
  WITH eligible_recruiters AS (
    SELECT p.id
    FROM public.profiles p
    WHERE p.role = 'rh_recruiter'
      -- EXCLUDE if they have a confirmed interview at any of the provided slots
      AND NOT EXISTS (
        SELECT 1 FROM public.recruit_interviews ri
        WHERE ri.interviewer_id = p.id
          AND ri.result = 'pending'
          AND (
            (p_slot1 IS NOT NULL AND date_trunc('hour', ri.scheduled_at) = v_slot_1_start) OR
            (p_slot2 IS NOT NULL AND date_trunc('hour', ri.scheduled_at) = v_slot_2_start) OR
            (p_slot3 IS NOT NULL AND date_trunc('hour', ri.scheduled_at) = v_slot_3_start)
          )
      )
      -- EXCLUDE if they have a provisional application at any of the provided slots
      -- (assuming status is still in pipeline)
      AND NOT EXISTS (
        SELECT 1 FROM public.recruit_applications ra
        WHERE ra.assigned_to = p.id
          AND ra.status_key IN ('new', 'validation', 'interview_scheduled')
          AND (
            (p_slot1 IS NOT NULL AND date_trunc('hour', ra.suggested_slot_1::timestamptz) = v_slot_1_start) OR
            (p_slot2 IS NOT NULL AND date_trunc('hour', ra.suggested_slot_1::timestamptz) = v_slot_2_start) OR
            (p_slot3 IS NOT NULL AND date_trunc('hour', ra.suggested_slot_1::timestamptz) = v_slot_3_start)
          )
      )
  )
  SELECT er.id INTO v_recruiter_id
  FROM eligible_recruiters er
  -- Join with applications to find the least busy for load balancing
  LEFT JOIN public.recruit_applications ra ON ra.assigned_to = er.id 
    AND ra.created_at >= date_trunc('day', now())
  GROUP BY er.id
  ORDER BY count(ra.id) ASC, random()
  LIMIT 1;

  RETURN v_recruiter_id;
END;
$$;
