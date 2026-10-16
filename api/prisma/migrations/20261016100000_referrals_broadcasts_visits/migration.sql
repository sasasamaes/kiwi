-- AlterTable
ALTER TABLE "users" ADD COLUMN "referred_by_code" TEXT;

-- CreateIndex
CREATE INDEX "users_referred_by_code_idx" ON "users"("referred_by_code");

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "offers" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateTable
CREATE TABLE "broadcast_logs" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "subject" TEXT,
    "preview" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "sent_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcast_logs_created_at_idx" ON "broadcast_logs"("created_at");

-- CreateTable
CREATE TABLE "sales_visits" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city_slug" TEXT NOT NULL DEFAULT 'nicoya',
    "outcome" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "follow_up_at" TIMESTAMP(3),
    "invitation_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_visits_outcome_follow_up_at_idx" ON "sales_visits"("outcome", "follow_up_at");

-- CreateIndex
CREATE INDEX "sales_visits_business_name_idx" ON "sales_visits"("business_name");

-- Códigos iniciales de lanzamiento (ofertas editables desde el admin).
INSERT INTO "referral_codes" ("id", "code", "active", "offers", "created_at", "updated_at") VALUES
('kiko-launch-0001', 'KIKO', true,
 '{"customer":{"title":"₡2.000 de regalo en tu primer pedido","detail":"Registrate con el código KIKO y te regalamos ₡2.000 para tu primer pedido en Kiwi."},"merchant":{"title":"Primer mes con comisión reducida","detail":"Sumá tu comercio con el código KIKO y pagás comisión reducida durante el primer mes."},"driver":{"title":"Bono de bienvenida + bolsa Kiwi","detail":"Empezá a repartir con el código KIKO: bono en tus primeros 10 viajes y bolsa de regalo."}}',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('wicho-launch-0001', 'WICHO', true,
 '{"customer":{"title":"Envío gratis en tus primeros 3 pedidos","detail":"Registrate con el código WICHO y el envío de tus primeros 3 pedidos va por nuestra cuenta."},"merchant":{"title":"Publicación destacada 2 semanas","detail":"Sumá tu comercio con el código WICHO y aparecés primero en el feed durante 2 semanas."},"driver":{"title":"Bono de bienvenida + mantenimiento","detail":"Empezá a repartir con el código WICHO: bono en tus primeros 10 viajes y descuento en mantenimiento."}}',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
