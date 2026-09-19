-- Tasa de comisión por pedido: 0.10 con crédito prepago, 0.15 otros medios.
-- Las filas viejas quedan en 0.10 (era la tasa única vigente).
ALTER TABLE "orders" ADD COLUMN "commission_rate" DECIMAL(4,3) NOT NULL DEFAULT 0.10;
