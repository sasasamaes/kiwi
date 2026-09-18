-- Add deliveryZone to orders (Nicoya zone catalog pricing)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_zone" TEXT;
