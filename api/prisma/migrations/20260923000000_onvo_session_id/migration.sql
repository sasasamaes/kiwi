-- Checkout hospedado de OnvoPay: la sesión (one-time-link) es el objeto de
-- cobro y el payment intent real llega después por webhook.
ALTER TABLE "payments" ADD COLUMN "onvo_session_id" TEXT;
