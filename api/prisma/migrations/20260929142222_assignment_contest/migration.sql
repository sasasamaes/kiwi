-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "OrderStatus" ADD VALUE 'pending_acceptance';
ALTER TYPE "OrderStatus" ADD VALUE 'no_driver';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "acceptance_expires_at" TIMESTAMP(3),
ADD COLUMN     "contest_ends_at" TIMESTAMP(3),
ADD COLUMN     "contest_started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_id" TEXT,
    "driver_id" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");
