-- Origen del pedido: los del link público/app cliente nacen client_app,
-- los del dashboard nacen merchant_panel (default, backfill seguro).
ALTER TABLE "orders" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'merchant_panel';
CREATE INDEX "orders_merchant_origin_status_created_idx" ON "orders"("merchant_id", "origin", "status", "created_at");
