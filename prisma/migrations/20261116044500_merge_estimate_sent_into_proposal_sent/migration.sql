-- Merge "Estimate Sent" into "Proposal Sent": reassign leads, delete stage, compact positions.

UPDATE leads
SET stage_id = (SELECT id FROM pipeline_stages WHERE name = 'Proposal Sent' LIMIT 1),
    stage_changed_at = NOW()
WHERE stage_id = (SELECT id FROM pipeline_stages WHERE name = 'Estimate Sent' LIMIT 1);

DELETE FROM pipeline_stages WHERE name = 'Estimate Sent';

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 AS new_pos
  FROM pipeline_stages
)
UPDATE pipeline_stages ps
SET position = ordered.new_pos
FROM ordered
WHERE ps.id = ordered.id;
