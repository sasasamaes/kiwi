-- AlterTable
ALTER TABLE "merchant_profiles" ADD COLUMN     "parent_merchant_id" TEXT,
ADD COLUMN     "transfers_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "transfer_to_merchant_id" TEXT;

-- CreateIndex
CREATE INDEX "orders_transfer_to_merchant_id_idx" ON "orders"("transfer_to_merchant_id");

-- AddForeignKey
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_parent_merchant_id_fkey" FOREIGN KEY ("parent_merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
