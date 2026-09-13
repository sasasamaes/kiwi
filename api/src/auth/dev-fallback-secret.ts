import { randomBytes } from 'node:crypto';

/**
 * Dev-only fallback so the API boots without a .env at all.
 *
 * Computed once per process (module singleton) so the JWT signing key and the
 * passport verifying key always match. Random per boot: no hardcoded secret
 * exists anywhere in the repo, and if production were ever misconfigured
 * (NODE_ENV !== 'production' with no JWT_SECRET), tokens could not survive a
 * restart or be forged from a publicly known value.
 *
 * Production still refuses to boot without JWT_SECRET (checked in auth.module
 * and jwt.strategy) — this path exists purely for local development.
 */
export const DEV_FALLBACK_SECRET = randomBytes(48).toString('base64');
