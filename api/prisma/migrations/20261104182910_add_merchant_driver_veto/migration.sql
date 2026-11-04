-- CreateTable
CREATE TABLE "merchant_driver_vetoes" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_driver_vetoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_driver_vetoes_merchant_id_driver_id_key" ON "merchant_driver_vetoes"("merchant_id", "driver_id");

-- AddForeignKey
ALTER TABLE "merchant_driver_vetoes" ADD CONSTRAINT "merchant_driver_vetoes_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_driver_vetoes" ADD CONSTRAINT "merchant_driver_vetoes_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
