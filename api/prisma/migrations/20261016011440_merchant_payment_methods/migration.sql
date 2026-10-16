-- AlterTable
ALTER TABLE "merchant_profiles" ADD COLUMN     "cash_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sinpe_enabled" BOOLEAN NOT NULL DEFAULT true;
