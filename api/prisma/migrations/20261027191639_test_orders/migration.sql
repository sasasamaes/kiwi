-- AlterTable
ALTER TABLE "merchant_profiles" ADD COLUMN     "test_orders_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "test_orders_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "is_test" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "orders_is_test_idx" ON "orders"("is_test");
