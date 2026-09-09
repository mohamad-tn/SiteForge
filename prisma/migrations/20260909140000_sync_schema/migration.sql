-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('none', 'pending', 'active', 'error');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "customCss" TEXT,
ADD COLUMN     "customDomain" TEXT,
ADD COLUMN     "domainStatus" "DomainStatus" NOT NULL DEFAULT 'none',
ADD COLUMN     "favicon" TEXT,
ADD COLUMN     "ogImage" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "SiteEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "locale" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "blockId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteEvent_siteId_createdAt_idx" ON "SiteEvent"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteEvent_siteId_type_idx" ON "SiteEvent"("siteId", "type");

-- CreateIndex
CREATE INDEX "SiteEvent_createdAt_idx" ON "SiteEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Collection_siteId_idx" ON "Collection"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_siteId_slug_key" ON "Collection"("siteId", "slug");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_sort_idx" ON "CollectionItem"("collectionId", "sort");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_published_idx" ON "CollectionItem"("collectionId", "published");

-- CreateIndex
CREATE INDEX "FormSubmission_siteId_createdAt_idx" ON "FormSubmission"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "FormSubmission_siteId_blockId_idx" ON "FormSubmission"("siteId", "blockId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_customDomain_key" ON "Site"("customDomain");

-- CreateIndex
CREATE INDEX "Site_customDomain_idx" ON "Site"("customDomain");

-- CreateIndex
CREATE INDEX "Site_domainStatus_idx" ON "Site"("domainStatus");

-- CreateIndex
CREATE INDEX "Site_ownerId_updatedAt_idx" ON "Site"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Site_ownerId_name_idx" ON "Site"("ownerId", "name");

-- CreateIndex
CREATE INDEX "Site_publishedAt_idx" ON "Site"("publishedAt");

-- CreateIndex
CREATE INDEX "Site_updatedAt_idx" ON "Site"("updatedAt");

-- CreateIndex
CREATE INDEX "Site_createdAt_idx" ON "Site"("createdAt");

-- CreateIndex
CREATE INDEX "Template_category_idx" ON "Template"("category");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");

-- AddForeignKey
ALTER TABLE "SiteEvent" ADD CONSTRAINT "SiteEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
