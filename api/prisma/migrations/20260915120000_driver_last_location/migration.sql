-- Ubicación "última conocida" de cada repartidor, para targeting de alertas
-- de pedidos por proximidad (driver.orders.new ya no es un topic ciego).
ALTER TABLE "driver_profiles" ADD COLUMN "last_lat"  DECIMAL(10,8);
ALTER TABLE "driver_profiles" ADD COLUMN "last_lng"  DECIMAL(11,8);
ALTER TABLE "driver_profiles" ADD COLUMN "last_seen_at" TIMESTAMP(3);

-- Backfill: los repartidores existentes heredan el centro del pueblo
-- (Nicoya) como zona aproximada, para que nadie quede fuera del targeting
-- antes de su primer ping. last_seen_at queda NULL = frescura desconocida;
-- el selector la trata como "probablemente cerca" (fail-open).
UPDATE "driver_profiles" SET "last_lat" = 10.1483, "last_lng" = -85.4527;

-- El selector de destinatarios filtra por estado + coords: índice compuesto.
CREATE INDEX "driver_profiles_targeting_idx" ON "driver_profiles" ("status", "last_lat", "last_lng");
