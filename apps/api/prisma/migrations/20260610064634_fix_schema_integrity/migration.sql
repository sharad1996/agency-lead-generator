-- Fix 1: Update FK constraints to use onDelete: Cascade / SetNull

-- Company: Organization → Cascade
ALTER TABLE "Company" DROP CONSTRAINT "Company_tenantId_fkey";
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contact: Organization → Cascade
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_tenantId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contact: Company → Cascade
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_companyId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lead: Organization → Cascade
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_tenantId_fkey";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lead: Contact → Cascade
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_contactId_fkey";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lead: Company → Cascade
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_companyId_fkey";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Activity: Organization → Cascade
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_tenantId_fkey";
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Activity: Lead → SetNull (already correct in init, but ensure)
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_leadId_fkey";
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Opportunity: Lead → Cascade
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_leadId_fkey";
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Meeting: Lead → Cascade
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_leadId_fkey";
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Meeting: Opportunity → SetNull (already correct in init, but ensure)
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_opportunityId_fkey";
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Proposal: Opportunity → Cascade
ALTER TABLE "Proposal" DROP CONSTRAINT "Proposal_opportunityId_fkey";
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OutreachSequence: Lead → Cascade
ALTER TABLE "OutreachSequence" DROP CONSTRAINT "OutreachSequence_leadId_fkey";
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OutreachStep: OutreachSequence → Cascade
ALTER TABLE "OutreachStep" DROP CONSTRAINT "OutreachStep_sequenceId_fkey";
ALTER TABLE "OutreachStep" ADD CONSTRAINT "OutreachStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix 2: Add Organization FK to Opportunity, Meeting, Proposal, OutreachSequence, CaseStudy, RateCard

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseStudy" ADD CONSTRAINT "CaseStudy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix 3: Replace Contact email index with tenant-scoped unique constraint
DROP INDEX "Contact_email_idx";
CREATE UNIQUE INDEX "Contact_tenantId_email_key" ON "Contact"("tenantId", "email") NULLS NOT DISTINCT;

-- Fix 4: Add tenantId to OutreachStep
ALTER TABLE "OutreachStep" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT '';
CREATE INDEX "OutreachStep_tenantId_idx" ON "OutreachStep"("tenantId");

-- Fix 5: Add scheduledAt index to Meeting
CREATE INDEX "Meeting_scheduledAt_idx" ON "Meeting"("scheduledAt");

-- Fix 6: Add unique constraint to RateCard
CREATE UNIQUE INDEX "RateCard_tenantId_role_seniorityLevel_key" ON "RateCard"("tenantId", "role", "seniorityLevel");
