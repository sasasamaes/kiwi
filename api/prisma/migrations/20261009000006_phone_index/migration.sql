-- Algunas bases (sincronizadas con db push) tienen el unique de phone como
-- índice suelto en vez de constraint: cubrir ambos casos. En prod con
-- constraint, la 00005 ya lo soltó y esto es no-op.
DROP INDEX IF EXISTS "users_phone_key";
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");
