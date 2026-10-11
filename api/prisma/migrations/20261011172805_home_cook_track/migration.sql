-- AlterEnum
ALTER TYPE "MerchantCategory" ADD VALUE 'cocina_casera';

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "available_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "merchant_profiles" ADD COLUMN     "is_home_cook" BOOLEAN NOT NULL DEFAULT false;
