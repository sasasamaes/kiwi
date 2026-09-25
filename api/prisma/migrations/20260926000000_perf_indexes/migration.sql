-- Optimización BD + performance: índices para los filtros reales
-- (dashboards por merchant/driver+status+fecha, pagos por estado/método,
-- retiros, ratings, notificaciones, alertas, KYC, contacto, items).
-- Solo CREATE INDEX IF NOT EXISTS: seguro, idempotente, sin reescritura.

-- Orders: triples que piden los listados + ranges de analytics
CREATE INDEX IF NOT EXISTS "orders_merchant_status_created_idx" ON "orders"("merchant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "orders_driver_status_created_idx" ON "orders"("driver_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "orders_driver_status_delivered_idx" ON "orders"("driver_id", "status", "delivered_at");
CREATE INDEX IF NOT EXISTS "orders_status_delivered_idx" ON "orders"("status", "delivered_at");

-- Driver proposals: lookup por pedido + invariante 1 propuesta/driver
CREATE INDEX IF NOT EXISTS "driver_proposals_order_driver_idx" ON "driver_proposals"("order_id", "driver_id");
CREATE INDEX IF NOT EXISTS "driver_proposals_order_status_idx" ON "driver_proposals"("order_id", "status");

-- Payments: filtros admin, guards por onvo ids, conciliación crypto
CREATE INDEX IF NOT EXISTS "payments_status_created_idx" ON "payments"("status", "created_at");
CREATE INDEX IF NOT EXISTS "payments_method_status_created_idx" ON "payments"("method", "status", "created_at");
CREATE INDEX IF NOT EXISTS "payments_onvo_payment_id_idx" ON "payments"("onvo_payment_id");
CREATE INDEX IF NOT EXISTS "payments_onvo_session_id_idx" ON "payments"("onvo_session_id");
CREATE INDEX IF NOT EXISTS "payments_wallet_status_idx" ON "payments"("crypto_wallet_address", "status");

-- Ratings: 1 lookup por pedido + rankings por fecha
CREATE INDEX IF NOT EXISTS "ratings_order_idx" ON "ratings"("order_id");
CREATE INDEX IF NOT EXISTS "ratings_driver_created_idx" ON "ratings"("driver_id", "created_at");
CREATE INDEX IF NOT EXISTS "ratings_merchant_created_idx" ON "ratings"("merchant_id", "created_at");

-- Withdrawals: panel driver + cola pending del admin
CREATE INDEX IF NOT EXISTS "withdrawals_driver_status_created_idx" ON "withdrawals"("driver_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "withdrawals_status_created_idx" ON "withdrawals"("status", "created_at");

-- Notifications: inbox por tipo (chat/traffic) además del filtro por leído
CREATE INDEX IF NOT EXISTS "notifications_user_type_created_idx" ON "notifications"("user_id", "type", "created_at");

-- Traffic: expiración + estado por driver
CREATE INDEX IF NOT EXISTS "traffic_alerts_expires_idx" ON "traffic_alerts"("expires_at");
CREATE INDEX IF NOT EXISTS "traffic_alert_notif_driver_dismissed_idx" ON "traffic_alert_notifications"("driver_id", "dismissed");
CREATE INDEX IF NOT EXISTS "traffic_alert_notif_alert_idx" ON "traffic_alert_notifications"("alert_id");

-- KYC + contacto: colas por estado
CREATE INDEX IF NOT EXISTS "kyc_verifications_status_created_idx" ON "kyc_verifications"("status", "created_at");
CREATE INDEX IF NOT EXISTS "contact_messages_status_created_idx" ON "contact_messages"("status", "created_at");

-- Order items: detalle por pedido + uso por producto
CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_items_menu_item_idx" ON "order_items"("menu_item_id");
