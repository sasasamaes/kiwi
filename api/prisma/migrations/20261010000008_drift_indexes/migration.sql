-- Índice que declara el schema (@@index([citySlug])) y faltaba en la DB.
CREATE INDEX "merchant_profiles_city_slug_idx" ON "merchant_profiles"("city_slug");
