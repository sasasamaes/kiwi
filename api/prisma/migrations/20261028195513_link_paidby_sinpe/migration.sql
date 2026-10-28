-- AlterTable
ALTER TABLE "delivery_links" ADD COLUMN     "paid_by" TEXT NOT NULL DEFAULT 'merchant';

-- AlterTable
ALTER TABLE "merchant_profiles" ADD COLUMN     "sinpe_number" TEXT;
