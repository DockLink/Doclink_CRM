-- Separate Proposal Sent follow-up schedule from general / log-call follow-up.
ALTER TABLE "leads" ADD COLUMN "follow_up_updated_at" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "proposal_follow_up_date" DATE;
ALTER TABLE "leads" ADD COLUMN "proposal_follow_up_time" TIME;
ALTER TABLE "leads" ADD COLUMN "proposal_follow_up_updated_at" TIMESTAMP(3);

-- Backfill general follow-up edit stamp so list resolution works for existing rows.
UPDATE "leads"
SET "follow_up_updated_at" = COALESCE("last_activity_at", "created_at")
WHERE "follow_up_date" IS NOT NULL;
