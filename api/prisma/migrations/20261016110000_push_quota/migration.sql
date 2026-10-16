-- AlterTable
ALTER TABLE "merchant_profiles" ADD COLUMN "push_credits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "push_announcements" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reached" INTEGER NOT NULL DEFAULT 0,
    "free" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_announcements_merchant_id_created_at_idx" ON "push_announcements"("merchant_id", "created_at");
