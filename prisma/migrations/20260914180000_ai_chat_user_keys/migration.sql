-- AlterTable
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "keySource" TEXT NOT NULL DEFAULT 'platform';

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiChatThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachmentMeta" JSONB,
    "steps" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserAiSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL DEFAULT 'openai',
    "encryptedApiKey" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAiSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiChatThread_userId_siteId_key" ON "AiChatThread"("userId", "siteId");
CREATE INDEX IF NOT EXISTS "AiChatThread_siteId_idx" ON "AiChatThread"("siteId");
CREATE INDEX IF NOT EXISTS "AiChatThread_userId_updatedAt_idx" ON "AiChatThread"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "AiChatMessage_threadId_createdAt_idx" ON "AiChatMessage"("threadId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "UserAiSettings_userId_key" ON "UserAiSettings"("userId");
CREATE INDEX IF NOT EXISTS "AiUsageLog_keySource_createdAt_idx" ON "AiUsageLog"("keySource", "createdAt");

DO $$ BEGIN
 ALTER TABLE "AiChatThread" ADD CONSTRAINT "AiChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "AiChatThread" ADD CONSTRAINT "AiChatThread_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AiChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "UserAiSettings" ADD CONSTRAINT "UserAiSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
