-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "extra_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "is_mandado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchase_estimate" DECIMAL(10,2),
ADD COLUMN     "purchase_store" TEXT,
ADD COLUMN     "receipt_amount" DECIMAL(10,2);
