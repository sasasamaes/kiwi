-- Didit hosted KYC: sesión por verificación + idempotencia de webhooks.
ALTER TABLE "kyc_verifications" ADD COLUMN "didit_session_id" TEXT;
ALTER TABLE "kyc_verifications" ADD COLUMN "didit_status" TEXT;
ALTER TABLE "kyc_verifications" ADD COLUMN "didit_url" TEXT;
ALTER TABLE "kyc_verifications" ADD COLUMN "didit_verified_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "kyc_verifications_didit_session_id_key" ON "kyc_verifications"("didit_session_id");

-- event_id único por delivery: dos retries concurrentes no pasan dos veces.
CREATE TABLE "didit_webhook_events" (
  "event_id" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "didit_webhook_events_pkey" PRIMARY KEY ("event_id")
);
