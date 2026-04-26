-- AlterTable
ALTER TABLE "Tally" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Tally" ADD COLUMN "deletedBy" TEXT;

-- CreateIndex
CREATE INDEX "Tally_deletedAt_idx" ON "Tally"("deletedAt");
