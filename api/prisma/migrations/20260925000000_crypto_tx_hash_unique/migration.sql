-- Evita que una misma transacción on-chain acredite dos pedidos distintos
-- (webhook reenviado con otro orderId, doble gasto lógico).
-- En PostgreSQL los NULL son distintos entre sí: las filas no-crypto no chocan.
CREATE UNIQUE INDEX "payments_crypto_tx_hash_key" ON "payments"("crypto_tx_hash");
