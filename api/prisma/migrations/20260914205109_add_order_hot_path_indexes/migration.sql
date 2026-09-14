-- CreateIndex
CREATE INDEX "orders_merchant_id_status_idx" ON "orders"("merchant_id", "status");

-- CreateIndex
CREATE INDEX "orders_merchant_id_created_at_idx" ON "orders"("merchant_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_driver_id_status_idx" ON "orders"("driver_id", "status");

-- CreateIndex
CREATE INDEX "orders_driver_id_created_at_idx" ON "orders"("driver_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");
