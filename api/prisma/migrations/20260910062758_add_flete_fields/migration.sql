-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "declared_value" DECIMAL(10,2),
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'food',
ADD COLUMN     "package_description" TEXT,
ADD COLUMN     "package_size" TEXT,
ADD COLUMN     "products_total" DECIMAL(10,2) NOT NULL DEFAULT 0;
