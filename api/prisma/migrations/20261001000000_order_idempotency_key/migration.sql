-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_merchant_idempotency_uk" ON "orders"("merchant_id", "idempotency_key");

