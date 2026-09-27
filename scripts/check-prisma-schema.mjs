#!/usr/bin/env node
// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Prisma schema invariant: exactly one tracked schema must exist.
 *
 * Canonical schema: api/prisma/schema.prisma
 *
 * A duplicate copy used to live at packages/db/prisma/schema.prisma.
 * It drifted silently (it lost the kycVerification relation on
 * MerchantProfile) and had to be deleted. This check fails if any
 * other *.prisma schema is ever tracked again, so the drift cannot
 * come back unnoticed.
 *
 * - ERROR (exit 1): more than one tracked schema, or the canonical
 *   one is missing/untracked.
 * - Warns (exit 0) about *.prisma files that are clearly not schemas
 *   (e.g. generated fragments) so new paths are visible.
 *
 * Usage: node scripts/check-prisma-schema.mjs
 */

import { execSync } from 'node:child_process';

const CANONICAL = 'api/prisma/schema.prisma';

function listTrackedPrismaFiles() {
  const out = execSync('git ls-files -z', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return out.split('\0').filter((f) => /\.prisma$/i.test(f));
}

const files = listTrackedPrismaFiles();

const errors = [];
const notes = [];

if (!files.includes(CANONICAL)) {
  errors.push(`Canonical schema is missing or untracked: ${CANONICAL}`);
}

const others = files.filter((f) => f !== CANONICAL);
if (others.length > 0) {
  errors.push(
    `Expected exactly one tracked Prisma schema (${CANONICAL}) but found ${others.length} extra:\n` +
      others.map((f) => `   ${f}`).join('\n'),
  );
}

// Non-schema .prisma files (rare, but keep them visible).
const GENERATED_HINT = /generated|fragment|module-graph/i;
for (const f of others) {
  if (GENERATED_HINT.test(f)) notes.push(`${f} looks generated — consider ignoring it in .gitignore instead of tracking it.`);
}

if (notes.length) {
  console.log('\nℹ️  Notes:');
  for (const n of notes) console.log(`   ${n}`);
}

if (errors.length) {
  console.error(`\n❌ Prisma schema invariant violated:\n`);
  for (const e of errors) console.error(`   ${e}\n`);
  console.error(
    `A second schema copy drifted silently once before (packages/db).\n` +
      `Keep api/prisma/schema.prisma as the single source of truth and\n` +
      `reference it from anywhere else instead of copying it.`,
  );
  process.exit(1);
}

console.log(`✅ Prisma schema invariant holds: exactly one tracked schema (${CANONICAL}).`);
