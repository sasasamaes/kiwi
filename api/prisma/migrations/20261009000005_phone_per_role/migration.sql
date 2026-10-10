-- El teléfono deja de ser unique global: la misma persona puede tener
-- cuenta de cliente, comercio y repartidor con el mismo número (la unicidad
-- pasa a ser (phone, role) y se valida en el servicio).
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_key";
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");
