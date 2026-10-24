-- CreateTable
CREATE TABLE "delivery_links" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "delivery_zone" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "order_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_links_token_hash_key" ON "delivery_links"("token_hash");

-- CreateIndex
CREATE INDEX "delivery_links_merchant_id_status_created_at_idx" ON "delivery_links"("merchant_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "delivery_links" ADD CONSTRAINT "delivery_links_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_links" ADD CONSTRAINT "delivery_links_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
