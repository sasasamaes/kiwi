-- Crédito prepago de comercios + método de pago credit

-- 1) Enum nuevo (ALTER TYPE ... ADD VALUE no corre dentro de transacción)
CREATE TYPE "CreditTransactionKind" AS ENUM ('recharge', 'spend', 'refund');

CREATE TABLE "credit_transactions" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "kind" "CreditTransactionKind" NOT NULL,
  "reason" TEXT,
  "order_id" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_transactions_merchant_id_created_at_idx" ON "credit_transactions"("merchant_id", "created_at");

ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Saldo en el perfil del comercio
ALTER TABLE "merchant_profiles" ADD COLUMN "credit_balance" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 3) Método credit en pagos (recrear enum: ADD VALUE no anda en transacción)
CREATE TYPE "PaymentMethod_new" AS ENUM ('onvopay_card', 'onvopay_sinpe', 'crypto', 'cash', 'credit');
ALTER TABLE "payments" ALTER COLUMN "method" TYPE "PaymentMethod_new" USING "method"::text::"PaymentMethod_new";
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "PaymentMethod_old";
