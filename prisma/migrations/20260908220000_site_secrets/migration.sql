-- CreateTable
CREATE TABLE "SiteSecret" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteSecret_siteId_idx" ON "SiteSecret"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSecret_siteId_name_key" ON "SiteSecret"("siteId", "name");

-- AddForeignKey
ALTER TABLE "SiteSecret" ADD CONSTRAINT "SiteSecret_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
