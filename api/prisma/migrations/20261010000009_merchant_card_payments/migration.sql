-- Cobro con tarjeta/SINPE por comercio: el admin lo activa cuando el
-- comercio pasa el KYC de Onvo. Default apagado (solo efectivo).
ALTER TABLE "merchant_profiles" ADD COLUMN "card_payments_enabled" BOOLEAN NOT NULL DEFAULT false;
