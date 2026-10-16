-- CreateTable
CREATE TABLE "merchant_kiosks" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_kiosks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_kiosks_merchant_id_active_idx" ON "merchant_kiosks"("merchant_id", "active");

-- AddForeignKey
ALTER TABLE "merchant_kiosks" ADD CONSTRAINT "merchant_kiosks_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN "kiosk_id" TEXT;

-- CreateIndex
CREATE INDEX "menu_items_kiosk_id_idx" ON "menu_items"("kiosk_id");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_kiosk_id_fkey" FOREIGN KEY ("kiosk_id") REFERENCES "merchant_kiosks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "kiosk_name" TEXT;
