-- Recarga de crédito con tarjeta (autogestión del comercio vía Onvo
-- Checkout): nace pendiente y recién acredita al confirmarse el cobro
-- (webhook o polling). Usa el enum PaymentStatus existente.
CREATE TABLE "credit_topups" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CRC',
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "onvo_session_id" TEXT,
  "onvo_payment_id" TEXT,
  "onvo_checkout_url" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "credit_topups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_topups_merchant_id_created_at_idx" ON "credit_topups"("merchant_id", "created_at");
CREATE INDEX "credit_topups_onvo_session_id_idx" ON "credit_topups"("onvo_session_id");
CREATE INDEX "credit_topups_onvo_payment_id_idx" ON "credit_topups"("onvo_payment_id");

ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
