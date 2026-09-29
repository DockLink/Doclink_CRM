-- CreateIndex
CREATE INDEX "leads_stage_id_idx" ON "leads"("stage_id");

-- CreateIndex
CREATE INDEX "leads_assignee_id_idx" ON "leads"("assignee_id");

-- CreateIndex
CREATE INDEX "leads_follow_up_date_idx" ON "leads"("follow_up_date");

-- CreateIndex
CREATE INDEX "activities_lead_id_idx" ON "activities"("lead_id");

-- CreateIndex
CREATE INDEX "activities_created_at_logged_by_idx" ON "activities"("created_at", "logged_by");
