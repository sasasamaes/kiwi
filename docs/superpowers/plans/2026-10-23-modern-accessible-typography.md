# Modern Accessible Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch all three apps to Geist/Geist Mono and fix the shared focus, contrast, motion, skip-link, and small-text issues without changing behavior.

**Architecture:** Edit only shared foundations (`packages/ui` tokens/CSS) plus root layouts and four targeted component/page fixes; verify with type-check, production builds, and browser checks.

**Tech Stack:** Next.js 15 (`next/font/google`: `Geist`, `Geist_Mono`), Tailwind CSS with `packages/ui/src/tailwind-tokens.ts`, shared `packages/ui/src/design-system.css`.

## Global Constraints

- Do not change application behavior, navigation, business logic, API, or database code.
- Keep the existing blue Kiwi/Zona brand tokens and status colors; do not introduce a new palette.
- All UI copy stays in Costa Rican Spanish (voseo) where it already exists; this plan adds no user-facing copy.
- Minimum touch target 44px is already satisfied; do not shrink interactive element padding.
- Never regenerate or hand-edit `apps/driver/public/sw.js` or `apps/client/public/sw.js`.
- Run `npm run type-check` from the repo root and the production build of every touched app before finishing.

---

## File map

- Modify: `packages/ui/src/tailwind-tokens.ts` — font families only.
- Modify: `packages/ui/src/design-system.css` — single focus rule, selection dedupe, reduced-motion extension.
- Modify: `apps/web/app/layout.tsx`, `apps/driver/app/layout.tsx`, `apps/client/app/layout.tsx` — load Geist/Geist_Mono, drop Inter/Fraunces.
- Modify: `apps/web/app/globals.css`, `apps/driver/app/globals.css`, `apps/client/app/globals.css` — remove conflicting local focus/selection/body-font overrides only.
- Modify: `packages/ui/src/SkipToContent.tsx` — central skip-link repair.
- Modify: `apps/web/app/admin/layout.tsx` — sidebar group label contrast/size.
- Modify: `apps/client/app/mandados/page.tsx` — CTA and helper-text contrast.
- Modify: `apps/driver/app/components/BottomNav.tsx` — label size 10px to 12px.
- Modify: `packages/ui/src/TrafficPredictions.tsx` — chart hour labels 8px to 12px.

---

### Task 1: Shared font tokens switch to Geist

**Files:**

- Modify: `packages/ui/src/tailwind-tokens.ts:128-133`

**Interfaces:**

- Consumes: existing `kiwiDesignTokens.theme.extend.fontFamily` shape.
- Produces: `font-display`, `font-sans`, `font-body` resolving to `var(--font-geist)`; `font-mono` to `var(--font-geist-mono)` for all three apps.

- [ ] **Step 1: Replace the fontFamily block**

```ts
      fontFamily: {
        display: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        body: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
      },
```

- [ ] **Step 2: Verify no Inter/Fraunces references remain in the token file**

Run: `grep -n "inter\|fraunces\|Inter\|Fraunces" packages/ui/src/tailwind-tokens.ts`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/tailwind-tokens.ts
git commit -m "Switch shared font tokens to Geist"
```

---

### Task 2: Single shared focus treatment, selection dedupe, reduced-motion extension

**Files:**

- Modify: `packages/ui/src/design-system.css:268-294` (selection and focus blocks)
- Modify: `packages/ui/src/design-system.css:355-366` (reduced-motion block)

**Interfaces:**

- Consumes: existing `.reveal`, `.zona-wave-bg`, `.press`, `.skeleton`, `.shimmer`, `.animate-float`, `.animate-pulse-soft`, perpetual animation classes.
- Produces: one focus rule with dark variant; one selection rule; reduced-motion covering all perpetual CSS animations plus smooth scrolling.

- [ ] **Step 1: Replace the duplicated selection and focus blocks with one rule**

Old (delete the first `::selection` + green `:focus-visible` block at lines 272-281, keep and extend the Blue Zone block):

```css
/* Foco visible único: kiwi-700 en claro, kiwi-300 en oscuro (AA no-texto). */
*:focus-visible {
  outline: 2px solid #195a77;
  outline-offset: 2px;
  border-radius: 4px;
}

.dark *:focus-visible {
  outline-color: #7cc0da;
}
```

Keep exactly one `::selection` block (the Blue Zone one at lines 287-290); delete the earlier duplicate.

- [ ] **Step 2: Extend the reduced-motion block**

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto !important;
  }
  .reveal,
  .reveal-delay-1,
  .reveal-delay-2,
  .reveal-delay-3,
  .zona-wave-bg,
  .press,
  .animate-perpetual-pulse,
  .animate-perpetual-float,
  .animate-perpetual-shimmer,
  .animate-perpetual-glow,
  .skeleton,
  .shimmer,
  .animate-float,
  .animate-pulse-soft {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
```

Note: framer-motion (JS-driven) animations are out of scope for this CSS rule; do not claim they are disabled.

- [ ] **Step 3: Verify the file has exactly one focus rule and one selection rule**

Run: `grep -n "focus-visible" packages/ui/src/design-system.css` (expect the base rule plus the `.dark` variant only) and `grep -n "::selection" packages/ui/src/design-system.css` (expect one).
Expected: no green `#22c55e` focus outline remains.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/design-system.css
git commit -m "Unify focus ring and extend reduced-motion coverage"
```

---

### Task 3: Load Geist in all three root layouts

**Files:**

- Modify: `apps/web/app/layout.tsx:3-32,49`
- Modify: `apps/driver/app/layout.tsx:3-31,55`
- Modify: `apps/client/app/layout.tsx:3-27,50`

**Interfaces:**

- Consumes: `next/font/google` `Geist` and `Geist_Mono` (available in Next.js 15.5).
- Produces: `--font-geist` and `--font-geist-mono` CSS variables on `<html>` in every app; no Inter/Fraunces variables.

- [ ] **Step 1: Web layout — replace the font imports and html class**

```tsx
import { Geist, Geist_Mono } from 'next/font/google';
```

```tsx
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});
```

```tsx
<html
  lang="es"
  className={`${geist.variable} ${geistMono.variable}`}
  suppressHydrationWarning
>
```

Delete the `Fraunces` and `Inter` declarations. Leave everything else in the file untouched.

- [ ] **Step 2: Driver layout — same replacement**

Apply the identical import/declaration/className change as Step 1 to `apps/driver/app/layout.tsx`. Keep the viewport export, metadata, and provider tree untouched.

- [ ] **Step 3: Client layout — same replacement plus add Geist_Mono**

Client currently loads only Inter and Fraunces and has no mono variable. Apply the Step 1 change so Client also gets `--font-geist-mono`. Keep providers, `UnauthorizedHandler`, and `AppGate` untouched.

- [ ] **Step 4: Verify no Inter/Fraunces font loading remains**

Run: `grep -rn "Fraunces\|from 'next/font/google'" apps/web/app/layout.tsx apps/driver/app/layout.tsx apps/client/app/layout.tsx | grep -v "Geist"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx apps/driver/app/layout.tsx apps/client/app/layout.tsx
git commit -m "Load Geist fonts in all three apps"
```

---

### Task 4: Remove conflicting local CSS overrides

**Files:**

- Modify: `apps/driver/app/globals.css:21-27` (body font-family), `:174-182` (focus/selection)
- Modify: `apps/client/app/globals.css:115-123` (focus/selection)
- Modify: `apps/web/app/globals.css:40-42,138-141` (smooth scroll scope note stays; dark input focus green)

**Interfaces:**

- Consumes: shared `design-system.css` focus/selection rules from Task 2 and `font-sans` body classes.
- Produces: no local `*:focus-visible`, `::selection`, or `body font-family` overrides competing with shared rules.

- [ ] **Step 1: Driver globals — delete the Inter body font stack**

Delete lines 21-27 (`font-family: 'Inter', system-ui, ... sans-serif;` plus its comment is redundant once removed — keep the background, min-height, smoothing, and color declarations). The body already uses `font-sans`.

- [ ] **Step 2: Driver and Client globals — delete local green focus and selection blocks**

Delete the `*:focus-visible` (`outline: 2px solid #22c55e`) and `::selection` green blocks in `apps/driver/app/globals.css:174-182` and `apps/client/app/globals.css:115-123`. Do not touch scrollbars, glass, badges, or gradients.

- [ ] **Step 3: Web globals — fix the dark input focus green**

```css
.dark .input-kiwi:focus {
  border-color: #7cc0da;
  box-shadow: 0 0 0 3px rgba(124, 192, 218, 0.25);
}
```

Leave the light-mode `focus:ring-kiwi-500` utility and all other web local styles untouched.

- [ ] **Step 4: Verify no functional green overrides remain (scrollbars, gradient text, and the `--kiwi-500` token stay)**

Run: `grep -rn "focus-visible\|::selection\|'Inter'" apps/web/app/globals.css apps/driver/app/globals.css apps/client/app/globals.css`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/globals.css apps/driver/app/globals.css apps/client/app/globals.css
git commit -m "Remove local focus and font overrides"
```

---

### Task 5: Central skip-link repair

**Files:**

- Modify: `packages/ui/src/SkipToContent.tsx`

**Interfaces:**

- Consumes: any page with a `<main>` landmark (all apps).
- Produces: skip link that always lands keyboard focus on page content, assigning `#main-content` only when the page lacks it.

- [ ] **Step 1: Add the click handler**

```tsx
'use client';

import { useCallback } from 'react';

/**
 * Enlace "Saltar al contenido" — primer elemento enfocable de cada app.
 * Visible solo al enfocar con teclado (WCAG 2.4.1 Bypass Blocks). Si la
 * página no marca #main-content, usa el primer <main> y lo etiqueta.
 */
export function SkipToContent() {
  const handleClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById('main-content') ?? document.querySelector('main');
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    if (!target.id) target.id = 'main-content';
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: false });
    target.scrollIntoView();
  }, []);

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-kiwi-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-kiwi-lg"
    >
      Saltar al contenido
    </a>
  );
}
```

- [ ] **Step 2: Type-check the shared package change**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json` (or the repo's type-check command if the package has no dedicated config).
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/SkipToContent.tsx
git commit -m "Repair skip link without editing every page"
```

---

### Task 6: Targeted contrast and size fixes

**Files:**

- Modify: `apps/web/app/admin/layout.tsx:217`
- Modify: `apps/client/app/mandados/page.tsx:479,486`
- Modify: `apps/driver/app/components/BottomNav.tsx:54`
- Modify: `packages/ui/src/TrafficPredictions.tsx:393`

**Interfaces:**

- Consumes: `kiwi-700`, `surface-500`, `orange-500`, `text-xs` tokens.
- Produces: AA-compliant informative text and minimum 12px metadata in the four flagged spots.

- [ ] **Step 1: Admin sidebar group labels**

```tsx
<p className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-surface-500 dark:text-surface-400">
```

- [ ] **Step 2: Mandado CTA — dark text on orange, larger helper text**

```tsx
className =
  'w-full rounded-full bg-orange-500 py-4 font-display text-[17px] font-bold text-surface-950 shadow-card transition-all active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-800 focus-visible:ring-offset-2';
```

```tsx
<p className="mt-1.5 text-center text-xs text-surface-500">
```

- [ ] **Step 3: Driver bottom-nav labels 10px to 12px**

```tsx
<span className="truncate text-xs leading-tight font-medium">{item.label}</span>
```

Keep the seven-item `flex-1` layout and existing padding; do not shrink touch targets.

- [ ] **Step 4: Traffic chart hour labels 8px to 12px**

```tsx
<p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/layout.tsx apps/client/app/mandados/page.tsx apps/driver/app/components/BottomNav.tsx packages/ui/src/TrafficPredictions.tsx
git commit -m "Fix small-text and low-contrast hotspots"
```

---

### Task 7: Verification pass and final commit state

**Files:**

- None (verification only; fix fallout in the task that owns it and amend there, then re-run).

**Interfaces:**

- Consumes: all changes from Tasks 1–6.
- Produces: green type-check, three production builds, and browser evidence.

- [ ] **Step 1: Monorepo type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 2: Production builds of all three apps**

Run: `npm run build --workspace=@kiwi/web`, driver, and client (or the repo's per-app build commands).
Expected: all succeed; no `sw.js` artifacts left modified (`git status --short` shows none).

- [ ] **Step 3: Browser checks (Playwright, light and dark, mobile 390px and desktop 1280px)**

On representative merchant, driver, and customer pages, confirm: body/display type resolves to Geist (computed `font-family`), money/IDs render in Geist Mono, the orange CTA and sidebar labels meet contrast, bottom-nav labels read at 12px, focus rings are visible in both themes, Tab from page start activates the skip link and lands focus in content, and `prefers-reduced-motion: reduce` stops CSS perpetual animations.

- [ ] **Step 4: Final review of the diff**

Run: `git status --short && git diff --stat`
Expected: only the files listed in this plan; no API, database, generated, or service-worker changes.
