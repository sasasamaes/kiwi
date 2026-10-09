-- Visibilidad en la lista pública: los comercios de test siguen activos
-- (QR, menú, pedidos) pero no aparecen en el feed de la app cliente.
ALTER TABLE "merchant_profiles" ADD COLUMN "is_listed" BOOLEAN NOT NULL DEFAULT true;

-- Comercio de test del dueño: activo para pruebas, oculto de la lista.
UPDATE "merchant_profiles" SET "is_listed" = false
WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" = 'sasasamaes13@gmail.com');
