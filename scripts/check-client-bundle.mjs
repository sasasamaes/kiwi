#!/usr/bin/env node
/**
 * Client bundle safety check.
 *
 * Why: Next.js only inlines *plain* `process.env.X` (and only NEXT_PUBLIC_*)
 * into browser bundles. Any other shape — `process.env?.X` (optional chaining),
 * dynamic `process.env[name]`, non-public vars like `process.env.STELLAR_*`,
 * or Vite-style `import.meta.env` — ships the raw `process` object (or leaves
 * `undefined`) to the browser. A bare `process` reference crashes every page
 * that loads the chunk: "process is not defined". This actually happened in
 * this repo (sentry.ts), so now it's enforced in CI.
 *
 * Tier 1 (source scan, always runs): scans client-side TS/TSX/JS for
 *   - FAIL: env patterns that Next cannot inline safely
 *   - WARN: module-scope (column 0) browser-only APIs (window/document/
 *           localStorage/sessionStorage/navigator) — crash during SSR/prerender
 *
 * Tier 2 (bundle scan, runs when a build exists or with --build): scans the
 * built client chunks under "apps/<app>/./next/static" (dot-next) for bare
 * `process` / `import.meta.env` leaks. Only static chunks are scanned —
 * server chunks legitimately use process.env.
 *
 * Usage:
 *   node scripts/check-client-bundle.mjs           # source + existing bundles
 *   node scripts/check-client-bundle.mjs --build   # build apps first, then scan
 *   node scripts/check-client-bundle.mjs --root /path/to/repo
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const args = process.argv.slice(2);
const shouldBuild = args.includes('--build');
const rootArgIdx = args.indexOf('--root');
const ROOT = rootArgIdx !== -1 ? args[rootArgIdx + 1] : process.cwd();

// ---------------------------------------------------------------------------
// Scope: everything that can end up in a browser bundle.
// `mobile` is React Native (runtime has no Next inlining contract), `api` is
// Node-only — both are out of scope.
// ---------------------------------------------------------------------------
const SOURCE_DIRS = ['apps/web', 'apps/client', 'apps/driver', 'packages/ui', 'packages/i18n'];
const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;
// Files executed by Node tooling or run outside the browser page context.
const SKIP_PATTERNS = [
  /(^|[\\/])next\.config\.(js|mjs|ts)$/,
  /(^|[\\/])\.next[\\/]/,
  /(^|[\\/])node_modules[\\/]/,
  /(^|[\\/])public[\\/]/, // service workers etc. — scanned at bundle level instead
  /\.d\.ts$/,
  /(^|[\\/])scripts[\\/]/,
  // Next.js Middleware (apps/<app>/middleware.ts) runs on the edge/server and
  // is never bundled into browser chunks — server-only env vars are safe here
  // (e.g. VENTAS_ACCESS_KEY). Narrow on purpose: a file merely NAMED
  // middleware elsewhere does not get the exemption.
  /(^|[\\/])apps[\\/][^\\/]+[\\/]middleware\.ts$/,
];

const failures = [];
const warnings = [];

function add(list, file, line, col, kind, message) {
  list.push({ file: relative(ROOT, file), line, col, kind, message });
}

// ---------------------------------------------------------------------------
// Tier 1 — source rules
// ---------------------------------------------------------------------------

// Env access Next cannot safely inline in a browser bundle.
// FAIL: optional chaining (defeats DefinePlugin), dynamic member access,
//       Vite-style import.meta.env, and non-public env vars.
const FAIL_ENV_PATTERNS = [
  { re: /process\s*\.\s*env\s*\?\s*\./g, why: 'optional-chained process.env is not inlined by Next — bare `process` ships to the browser' },
  { re: /process\s*\?\s*\./g, why: 'optional chaining on process is not inlined by Next — bare `process` ships to the browser' },
  { re: /process\s*\.\s*env\s*\[\s*[^\]]/g, why: 'dynamic process.env[...] access cannot be inlined — reaches the browser as raw process' },
  { re: /import\s*\.\s*meta\s*\.\s*env/g, why: 'import.meta.env is Vite syntax — always undefined in Next.js client bundles' },
  {
    re: /process\s*\.\s*env\s*\.\s*([A-Z_][A-Z0-9_]*)/g,
    why: (m) => `process.env.${m[1]} is not public — only NEXT_PUBLIC_* and NODE_ENV are inlined into browser bundles`,
    filter: (m) => m[1] !== 'NODE_ENV' && !m[1].startsWith('NEXT_PUBLIC_'),
  },
];

// Browser-only APIs at module scope (column 0) run during SSR/prerender and
// crash the build or the server render. Indented usage inside functions,
// effects and guarded branches is fine and common.
const MODULE_SCOPE_BROWSER_API =
  /^(window|document|localStorage|sessionStorage|navigator|location)\s*[.[=]/;

// `useState(() => window...)` runs its initializer during SSR — unlike useEffect.
const SSR_UNSAFE_LAZY_INIT = /useState\(\s*\(\s*\)\s*=>\s*(window|document|localStorage|sessionStorage|navigator|location)\s*[.\[]/;

function scanSourceFile(absPath) {
  const rel = relative(ROOT, absPath);
  const content = readFileSync(absPath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    for (const rule of FAIL_ENV_PATTERNS) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        if (rule.filter && !rule.filter(m)) continue;
        const why = typeof rule.why === 'function' ? rule.why(m) : rule.why;
        add(failures, absPath, lineNo, m.index + 1, 'env', `${m[0].trim()} — ${why}`);
      }
    }

    if (MODULE_SCOPE_BROWSER_API.test(line)) {
      add(warnings, absPath, lineNo, 1, 'browser-api',
        `module-scope browser API "${line.trim().slice(0, 60)}" runs during SSR/prerender — guard it or move it into an effect`);
    }

    const lazy = SSR_UNSAFE_LAZY_INIT.exec(line);
    if (lazy) {
      add(warnings, absPath, lineNo, lazy.index + 1, 'browser-api',
        `useState initializer calls ${lazy[1]} — lazy initializers run during SSR, move to useEffect or guard with typeof`);
    }
  });
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (SKIP_PATTERNS.some((re) => re.test(full))) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (SOURCE_EXT.test(entry.name)) yield full;
  }
}

// ---------------------------------------------------------------------------
// Tier 2 — built bundle rules
// ---------------------------------------------------------------------------

// Bare `process` followed by a property access, NOT preceded by `.`, `$`, a
// word char, or a quote (avoids `e.process(...)`, `self.process`,
// `"process.env"` inside string literals, minified property names).
const BUNDLE_PROCESS = /(?<![.\w$"'])(process\s*\.\s*(env|browser|version|platform|argv|cwd|exit|nextTick|stdout|stderr|memoryUsage|release|arch)|process\s*\[\s*["'])/g;
const BUNDLE_IMPORT_META_ENV = /import\s*\.\s*meta\s*\.\s*env/g;

function scanClientChunks(appDir) {
  const staticDir = join(appDir, '.next', 'static');
  if (!existsSync(staticDir)) return false;

  const stack = [staticDir];
  let scanned = 0;
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.js')) {
        scanned++;
        const content = readFileSync(full, 'utf8');
        const rel = relative(ROOT, full);
        for (const re of [BUNDLE_PROCESS, BUNDLE_IMPORT_META_ENV]) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(content)) !== null) {
            // Line number for the report
            const lineNo = content.slice(0, m.index).split('\n').length;
            const isProcess = re === BUNDLE_PROCESS;
            add(isProcess ? failures : warnings, full, lineNo, 1,
              isProcess ? 'bundle-process' : 'bundle-env',
              `built client chunk contains "${m[0].replace(/\s+/g, '').slice(0, 40)}" — will crash or misbehave in the browser`);
          }
        }
      }
    }
  }
  return scanned > 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('🔍 Client bundle safety check');
  console.log(`   root: ${ROOT}\n`);

  if (shouldBuild) {
    console.log('📦 Building client apps (turbo run build --filter=./apps/*)...');
    execSync('npx turbo run build --filter=./apps/*', { cwd: ROOT, stdio: 'inherit' });
    console.log('');
  }

  // Tier 1: source
  let sourceFiles = 0;
  for (const dir of SOURCE_DIRS) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) {
      console.warn(`⚠️  skipped missing source dir: ${dir}`);
      continue;
    }
    for (const file of walk(abs)) {
      sourceFiles++;
      scanSourceFile(file);
    }
  }
  console.log(`   scanned ${sourceFiles} source files in ${SOURCE_DIRS.length} client-side dirs`);

  // Tier 2: built bundles (if any exist)
  let bundleInfo = 'no build output found — bundle scan skipped (run with --build, or build first)';
  if (!shouldBuild) {
    const results = ['apps/web', 'apps/client', 'apps/driver'].map((app) => {
      const found = scanClientChunks(join(ROOT, app));
      return { app, found };
    });
    const scannedApps = results.filter((r) => r.found).length;
    if (scannedApps > 0) bundleInfo = `scanned .next/static client chunks of ${scannedApps}/3 apps`;
  } else {
    const results = ['apps/web', 'apps/client', 'apps/driver'].map((app) => ({
      app,
      found: scanClientChunks(join(ROOT, app)),
    }));
    bundleInfo = `scanned .next/static client chunks of ${results.filter((r) => r.found).length}/3 apps`;
  }
  console.log(`   ${bundleInfo}\n`);

  // Report
  if (warnings.length) {
    console.log(`⚠️  ${warnings.length} warning(s):`);
    for (const w of warnings) {
      console.log(`   ${w.file}:${w.line}:${w.col}  [${w.kind}] ${w.message}`);
    }
    console.log('');
  }

  if (failures.length) {
    console.error(`❌ ${failures.length} client-bundle safety violation(s):\n`);
    for (const f of failures) {
      console.error(`   ${f.file}:${f.line}:${f.col}  [${f.kind}] ${f.message}`);
    }
    console.error('\nFix: use plain `process.env.NEXT_PUBLIC_*` or `process.env.NODE_ENV` (Next inlines these),');
    console.error('or guard browser-only code with `typeof window !== "undefined"` / move it into useEffect.');
    process.exit(1);
  }

  console.log('✅ No client-bundle safety violations found.');
}

try {
  main();
} catch (err) {
  console.error(`❌ check failed to run: ${err.message}`);
  process.exit(2);
}
