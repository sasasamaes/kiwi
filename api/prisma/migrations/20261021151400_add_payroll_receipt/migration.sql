-- AlterTable
ALTER TABLE "withdrawals" ADD COLUMN     "period_end" TIMESTAMP(3),
ADD COLUMN     "period_start" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "withdrawal_items" (
    "id" TEXT NOT NULL,
    "withdrawal_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withdrawal_items_withdrawal_idx" ON "withdrawal_items"("withdrawal_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_items_withdrawal_order_uk" ON "withdrawal_items"("withdrawal_id", "order_id");

-- CreateIndex
CREATE INDEX "withdrawals_period_start_idx" ON "withdrawals"("period_start");

-- AddForeignKey
ALTER TABLE "withdrawal_items" ADD CONSTRAINT "withdrawal_items_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_items" ADD CONSTRAINT "withdrawal_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
