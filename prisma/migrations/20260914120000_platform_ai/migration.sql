-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('openai', 'anthropic', 'google', 'xai');

-- CreateTable
CREATE TABLE "PlatformAiSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" "AiProvider" NOT NULL DEFAULT 'openai',
    "encryptedApiKey" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultDailyLimit" INTEGER NOT NULL DEFAULT 20,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAiQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLimit" INTEGER,
    "usedToday" INTEGER NOT NULL DEFAULT 0,
    "resetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAiQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantAiQuota_userId_key" ON "TenantAiQuota"("userId");

-- CreateIndex
CREATE INDEX "TenantAiQuota_resetDate_idx" ON "TenantAiQuota"("resetDate");

-- CreateIndex
CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "AiUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_siteId_createdAt_idx" ON "AiUsageLog"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TenantAiQuota" ADD CONSTRAINT "TenantAiQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed singleton (disabled until admin sets key)
INSERT INTO "PlatformAiSettings" ("id", "provider", "model", "enabled", "defaultDailyLimit", "maxTokens", "updatedAt")
VALUES ('default', 'openai', 'gpt-4o-mini', false, 20, 4096, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
