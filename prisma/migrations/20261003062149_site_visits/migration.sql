-- CreateTable
CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "visitor_key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteVisit_day_idx" ON "SiteVisit"("day");

-- CreateIndex
CREATE UNIQUE INDEX "SiteVisit_day_visitor_key_key" ON "SiteVisit"("day", "visitor_key");
