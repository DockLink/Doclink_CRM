-- CreateIndex
CREATE INDEX "leads_stage_id_created_at_idx" ON "leads"("stage_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_assignee_id_created_at_idx" ON "leads"("assignee_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_follow_up_date_stage_id_idx" ON "leads"("follow_up_date", "stage_id");
