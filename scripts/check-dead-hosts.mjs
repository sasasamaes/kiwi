#!/usr/bin/env node
/**
 * Fails when tracked files reference dead infrastructure hosts.
 *
 * The project once planned to run on Railway and Supabase. That setup was
 * abandoned — production now runs on Render (API + Postgres) and Vercel
 * (frontends). Any reference to the dead hosts is a bug waiting to happen
 * (docs, env examples, fallbacks, deploy scripts), so CI fails.
 *
 * - ERROR (exit 1): a dead host appears in a tracked file.
 * - WARN (exit 0): suspicious-but-allowed patterns, for visibility only.
 *
 * This script necessarily contains the host patterns itself, so it is
 * excluded from its own scan (see SELF_FILE).
 *
 * Usage: node scripts/check-dead-hosts.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Paths that legitimately mention the hosts or produce only noise.
const EXCLUDED_PATHS = [
  /^package-lock\.json$/,
  /^node_modules\//,
  /^\.next\//,
  /^docs\/PRD\./, // historical product document, kept as-is
  /^\.git\//,
  /^dist\//,
  /^coverage\//,
  /^\.turbo\//,
];

// This file defines the patterns, so scanning itself is meaningless.
const SELF_FILE = 'scripts/check-dead-hosts.mjs';

// Email addresses like demo accounts are data, not host references —
// scrubbed before scanning so they never trip the host patterns.
const EMAIL_RE = /[\w.+-]+@(kiwi\.app|guest\.checkout\.invalid|example\.com)/gi;

const hostPatterns = [
  { host: 'kiwi.app', re: /\bkiwi\.app\b/gi }, // whole domain never registered (emails scrubbed first)
  { host: 'railway.app', re: /\brailway\.app\b/gi },
  { host: 'railway (generic)', re: /\brailway\b/gi },
  { host: 'supabase', re: /\bsupabase\b/gi },
  { host: 'neon.tech', re: /\bneon\.tech\b/gi },
];

function listTrackedFiles() {
  const out = execSync('git ls-files -z', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return out.split('\0').filter(Boolean);
}

function isExcluded(relPath) {
  return relPath === SELF_FILE || EXCLUDED_PATHS.some((re) => re.test(relPath));
}

const violations = [];
const warnings = [];
const seen = new Set(); // dedupe overlapping patterns on the same line

const files = listTrackedFiles();
for (const relPath of files) {
  if (isExcluded(relPath)) continue;

  let content;
  try {
    content = readFileSync(path.resolve(relPath), 'utf8');
  } catch {
    continue; // deleted from worktree but still tracked, binaries, etc.
  }

  const scrubbed = content.replace(EMAIL_RE, '<email>');

  for (const { host, re } of hostPatterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(scrubbed)) !== null) {
      const lineNo = scrubbed.slice(0, m.index).split('\n').length;
      const fullLine = scrubbed.split('\n')[lineNo - 1].trim();
      const lineText = fullLine.slice(0, 120);
      // Classification uses the FULL line (display is truncated above).
      // The word alone in prose (docs) is a warning; a URL/host-shaped
      // reference anywhere is an error.
      const isProseOnly = /\.(md|txt)$/i.test(relPath) && !/https?:\/\/|\w+\.(app|co|com|tech)\b/i.test(fullLine);
      const key = `${relPath}:${lineNo}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = { file: relPath, line: lineNo, host, text: lineText };
      if (isProseOnly) warnings.push(entry);
      else violations.push(entry);
    }
  }
}

if (warnings.length) {
  console.log('\n⚠️  Suspicious mentions (allowed, prose only):');
  for (const w of warnings) console.log(`   ${w.file}:${w.line} [${w.host}] ${w.text}`);
}

if (violations.length) {
  console.error(`\n❌ ${violations.length} dead-host reference(s) found:\n`);
  for (const v of violations) console.error(`   ${v.file}:${v.line} [${v.host}] ${v.text}`);
  console.error(
    `\nThese hosts belong to the abandoned Railway/Supabase setup.\n` +
      `Production runs on Render (API/DB) and Vercel (frontends).\n` +
      `Update the reference to the real host, or remove it.`,
  );
  process.exit(1);
}

console.log(`✅ No dead-host references in ${files.length} tracked files.`);
