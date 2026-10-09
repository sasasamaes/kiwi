-- Multiciudad + cuentas cliente + publicidad (día fijo) + push por zona
-- Nicoya activa hoy; Liberia y otras se activan con un UPDATE, sin migraciones.

-- CreateEnum
CREATE TYPE "AdCampaignType" AS ENUM ('spotlight', 'banner');
CREATE TYPE "AdCampaignStatus" AS ENUM ('pending', 'active', 'paused', 'ended', 'rejected');
CREATE TYPE "OfferStatus" AS ENUM ('pending', 'approved', 'sending', 'sent', 'rejected', 'cancelled');

-- AlterEnum: nuevo rol customer
ALTER TYPE "Role" ADD VALUE 'customer';

-- CreateTable cities
CREATE TABLE "cities" (
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "center_lat" DECIMAL(10, 8),
  "center_lng" DECIMAL(11, 8),
  "radius_km" INTEGER NOT NULL DEFAULT 10,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cities_pkey" PRIMARY KEY ("slug")
);

-- Seed mínimo multiciudad
INSERT INTO "cities" ("slug", "name", "center_lat", "center_lng", "radius_km", "active") VALUES
  ('nicoya', 'Nicoya', 10.1467, -85.4520, 10, true),
  ('liberia', 'Liberia', 10.6297, -85.4438, 15, false)
ON CONFLICT ("slug") DO NOTHING;

-- MerchantProfiles: ciudad operativa (backfill nicoya)
ALTER TABLE "merchant_profiles" ADD COLUMN "city_slug" TEXT NOT NULL DEFAULT 'nicoya';

-- CreateTable customer_profiles
CREATE TABLE "customer_profiles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "full_name" TEXT,
  "default_address" TEXT,
  "city_slug" TEXT NOT NULL DEFAULT 'nicoya',
  "latitude" DECIMAL(10, 8),
  "longitude" DECIMAL(11, 8),
  "delivery_zone" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "customer_profiles"("user_id");
CREATE INDEX "customer_profiles_city_slug_idx" ON "customer_profiles"("city_slug");

-- Orders: cliente logueado (nullable para no romper guests)
ALTER TABLE "orders" ADD COLUMN "customer_id" TEXT;
CREATE INDEX "orders_customer_status_created_idx" ON "orders"("customer_id", "status", "created_at");

-- CreateTable ad_campaigns
CREATE TABLE "ad_campaigns" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "city_slug" TEXT NOT NULL DEFAULT 'nicoya',
  "type" "AdCampaignType" NOT NULL,
  "title" TEXT,
  "image_url" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "status" "AdCampaignStatus" NOT NULL DEFAULT 'pending',
  "price_per_day" DECIMAL(10, 2) NOT NULL,
  "total_charged" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ad_campaigns_city_slug_status_starts_at_ends_at_idx" ON "ad_campaigns"("city_slug", "status", "starts_at", "ends_at");
CREATE INDEX "ad_campaigns_merchant_id_status_idx" ON "ad_campaigns"("merchant_id", "status");

-- CreateTable offer_broadcasts
CREATE TABLE "offer_broadcasts" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "city_slug" TEXT NOT NULL DEFAULT 'nicoya',
  "zone_id" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "image_url" TEXT,
  "link_merchant_id" TEXT,
  "status" "OfferStatus" NOT NULL DEFAULT 'pending',
  "cost_charged" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "approved_by" TEXT,
  "sent_at" TIMESTAMP(3),
  "scheduled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offer_broadcasts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "offer_broadcasts_city_slug_status_idx" ON "offer_broadcasts"("city_slug", "status");
CREATE INDEX "offer_broadcasts_merchant_id_status_idx" ON "offer_broadcasts"("merchant_id", "status");

-- CreateTable ad_events
CREATE TABLE "ad_events" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT,
  "broadcast_id" TEXT,
  "type" TEXT NOT NULL,
  "cost" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ad_events_campaign_id_created_at_idx" ON "ad_events"("campaign_id", "created_at");
CREATE INDEX "ad_events_broadcast_id_created_at_idx" ON "ad_events"("broadcast_id", "created_at");

-- Foreign keys (después del seed de cities para no violar FK en backfill)
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_city_slug_fkey" FOREIGN KEY ("city_slug") REFERENCES "cities"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_city_slug_fkey" FOREIGN KEY ("city_slug") REFERENCES "cities"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_city_slug_fkey" FOREIGN KEY ("city_slug") REFERENCES "cities"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offer_broadcasts" ADD CONSTRAINT "offer_broadcasts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offer_broadcasts" ADD CONSTRAINT "offer_broadcasts_city_slug_fkey" FOREIGN KEY ("city_slug") REFERENCES "cities"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "offer_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
