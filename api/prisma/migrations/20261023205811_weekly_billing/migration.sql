-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'weekly_invoice';

-- AlterTable
ALTER TABLE "merchant_profiles" ADD COLUMN     "weekly_billing_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "invoice_id" TEXT;

-- CreateTable
CREATE TABLE "merchant_invoices" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "trips" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_invoices_merchant_status_idx" ON "merchant_invoices"("merchant_id", "status", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_invoices_merchant_period_uk" ON "merchant_invoices"("merchant_id", "period_start");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- AddForeignKey
ALTER TABLE "merchant_invoices" ADD CONSTRAINT "merchant_invoices_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "merchant_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
