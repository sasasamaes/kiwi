# Modern, Accessible Typography and Shared UI Foundations

Date: 2026-10-23
Status: Approved design, pending implementation

## Context

Kiwi has three Next.js applications sharing `packages/ui`: merchant/admin (`apps/web`), driver (`apps/driver`), and customer (`apps/client`). `DESIGN.md` requires Geist and forbids Inter/serifs in operational UI, but all three layouts currently load Inter and Fraunces. Shared CSS also mixes the active blue `kiwi`/`zona` palette with older green focus styles.

Static review found these high-priority issues:

- Inter and Fraunces conflict with the documented type system; Client also lacks the Geist Mono variable required by shared tokens.
- Focus indicators are inconsistent and, in some apps, fail non-text contrast expectations.
- Informative text uses colors that do not meet the shared tokens' own contrast rules.
- Some CTA and metadata text is too small or too low contrast for outdoor/mobile use.
- The global skip link points to `#main-content`, but many pages do not provide that ID.
- `prefers-reduced-motion` does not cover all perpetual animations or smooth scrolling.

## Goal

Modernize typography and visual accessibility across all three apps through shared foundations, without changing application behavior, navigation, business logic, or the existing blue Kiwi/Zona identity.

## Non-goals

- A page-by-page visual redesign or a new brand palette.
- New UI features, dependencies, or design-system abstractions.
- Unrelated refactors of old `theme.ts` or `theme-kiwi.ts` files.

## Options considered

1. **Shared foundation pass (chosen).** Replace the font setup and fix global accessibility tokens and utilities. Lowest risk and covers every app consistently.
2. **Full per-screen redesign.** Higher visual impact, but much larger diff and regression surface. Deferred to a later phase.
3. **Font-only replacement.** Fast, but leaves focus, contrast, navigation, and skip-link problems unresolved.

## Design

### Typography

- Load `Geist` and `Geist_Mono` with `next/font/google` in all three root layouts, with `display: 'swap'` and self-hosting provided by Next.
- Use `--font-geist` for body and display text, and `--font-geist-mono` for money, IDs, times, and other dense numeric values.
- Update `packages/ui/src/tailwind-tokens.ts` so `font-display`, `font-sans`, and `font-body` resolve to Geist, and `font-mono` resolves to Geist Mono.
- Keep headings compact and readable, using existing component hierarchy rather than inventing new page-level typography.
- Meaningful metadata must not drop below 12px. Driver bottom-navigation labels move from 10px to 12px while retaining the seven-item mobile layout and at least 44px touch targets.

### Focus and contrast

- Use one shared focus treatment: a clearly visible outline using `kiwi-700` in light mode and `kiwi-300` in dark mode, with offset and adequate contrast.
- Remove local low-contrast green focus overrides so the shared rule wins consistently.
- Do not use `surface-400` for informative text in light mode; use `surface-500` or darker. Fix the admin group labels identified in `apps/web/app/admin/layout.tsx` and the customer mandado CTA contrast issue without changing the CTA's behavior.
- Preserve existing status colors and the blue Kiwi/Zona brand tokens.

### Accessibility behavior

- Fix the skip link centrally in `packages/ui/src/SkipToContent.tsx`: on activation, locate the first main landmark, assign `#main-content` if missing, and move keyboard focus there. This avoids editing every page while supporting existing and future screens.
- Extend the shared `prefers-reduced-motion` rule to perpetual shimmer/pulse/float/glow animations and disable smooth scrolling where configured locally.
- Keep existing keyboard handlers, labels, and interactive semantics; do not trade accessibility fixes for visual changes.

## Implementation boundaries

Expected files are limited to shared typography/style foundations and the specific contrast/navigation findings:

- `packages/ui/src/tailwind-tokens.ts`
- `packages/ui/src/design-system.css`
- `packages/ui/src/SkipToContent.tsx`
- `apps/{web,driver,client}/app/layout.tsx`
- `apps/{web,driver,client}/app/globals.css` only where local overrides conflict with shared rules
- `apps/web/app/admin/layout.tsx`
- `apps/client/app/mandados/page.tsx`
- `apps/driver/app/components/BottomNav.tsx`

No API, database, or test-data changes are expected.

## Verification

- Run `npm run type-check` across the monorepo.
- Build `apps/web`, `apps/driver`, and `apps/client`.
- Run existing relevant API tests if shared code paths require them; no API behavior is expected to change.
- Use Playwright to inspect representative merchant, driver, and customer pages at mobile and desktop widths in light and dark themes.
- Verify keyboard skip-link activation and visible focus, reduced-motion behavior, readable navigation labels, and the corrected CTA contrast.
- Do not regenerate or manually edit `apps/driver/public/sw.js` or `apps/client/public/sw.js` in the source diff.
