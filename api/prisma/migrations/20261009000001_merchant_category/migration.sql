-- Categorías de negocio: columna + autotag de los comercios ya registrados
-- por nombre (insensible a mayúsculas y tildes comunes). El orden del CASE
-- importa: lo específico primero (pizza antes que restaurante genérico).

-- CreateEnum
CREATE TYPE "MerchantCategory" AS ENUM (
  'restaurante', 'soda', 'pizzeria', 'cafe_brunch', 'panaderia',
  'mariscos', 'comida_rapida', 'saludable', 'bar', 'otro'
);

-- AddColumn (default restaurante para no dejar nulos en backfill parcial)
ALTER TABLE "merchant_profiles" ADD COLUMN "category" "MerchantCategory" NOT NULL DEFAULT 'restaurante';

-- Autotag por nombre del negocio
UPDATE "merchant_profiles" SET "category" = CASE
  WHEN lower(business_name) LIKE '%pizza%' THEN 'pizzeria'::"MerchantCategory"
  WHEN lower(business_name) LIKE '%ceviche%' OR lower(business_name) LIKE '%marisco%' OR lower(business_name) LIKE '%pescad%' THEN 'mariscos'::"MerchantCategory"
  WHEN lower(business_name) LIKE '%bowl%' OR lower(business_name) LIKE '%saludable%' OR lower(business_name) LIKE '%vegano%' OR lower(business_name) LIKE '%ensalada%' THEN 'saludable'::"MerchantCategory"
  WHEN lower(business_name) LIKE '%caf%' OR lower(business_name) LIKE '%coffee%' OR lower(business_name) LIKE '%brunch%' THEN 'cafe_brunch'::"MerchantCategory"
  WHEN lower(business_name) LIKE '%pan%' OR lower(business_name) LIKE '%bakery%' OR lower(business_name) LIKE '%reposter%' THEN 'panaderia'::"MerchantCategory"
  WHEN lower(business_name) LIKE '%burger%' OR lower(business_name) LIKE '%hamburguesa%' OR lower(business_name) LIKE '%taco%' THEN 'comida_rapida'::"MerchantCategory"
  WHEN lower(business_name) LIKE '%soda%' THEN 'soda'::"MerchantCategory"
  WHEN lower(business_name) LIKE '%bar%' OR lower(business_name) LIKE '%cantina%' OR lower(business_name) LIKE '%cerveza%' THEN 'bar'::"MerchantCategory"
  ELSE 'restaurante'::"MerchantCategory"
END;

CREATE INDEX "merchant_profiles_city_slug_category_idx" ON "merchant_profiles"("city_slug", "category");
