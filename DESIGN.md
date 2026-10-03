# Design System: Kiwi Delivery

Single source of truth for generating Kiwi screens (merchant dashboard, driver app,
customer menu/tracking) in Google Stitch or any AI screen generator. Enforces the
existing Kiwi identity — fresh-market green on slate neutrals, dark-mode first-class —
at a premium, non-generic bar.

## 1. Visual Theme & Atmosphere

A confident daily-operations tool with market-fresh energy: dense but breathable,
built for one-handed phone use on the street and quick merchant scans between orders.
Density 6 (Daily App Balanced, tipping toward Cockpit on the driver active-order
screen), Variance 6 (offset asymmetric — left-anchored summaries, right-anchored
money), Motion 6 (fluid spring physics on every state change, never decorative).

Think "well-run soda kitchen at rush hour": everything reachable, nothing shouting.

## 2. Color Palette & Roles

Single accent family: **Kiwi Leaf green**. Neutrals: Slate (light mode) / Zinc-tinted
midnight (dark mode). Never mix warm and cool grays in one screen.

- **Kiwi Leaf** (#22C55E) — Brand signature. Decorative only: glows, borders,
  active dots, focus rings. Never white text on top of it.
- **Kiwi Deep** (#15803D) — Primary CTA fill, prices, totals. The ONLY green that
  carries small text on light surfaces (4.81:1, AA).
- **Kiwi Ink** (#14532D) — Gradient end (700→800) for hero CTA buttons only.
- **Lime Pulse** (#4ADE80) — Hover, focus, secondary badges. Never body text.
- **Deep Emerald** (#10B981) — Success states and data-viz only.
- **Sunburst Amber** (#F59E0B) — Ratings, urgency, express flags. Sparingly.
- **SINPE Blue** (#0284C7) — Payment-method accent (Costa Rica SINPE). Only inside
  payment selectors, never as general UI accent.
- **Canvas Light** (#F8FAFC) — Primary background, light mode.
- **Pure Surface** (#FFFFFF) — Cards and sheets, light mode.
- **Midnight Canvas** (#0B1326) — Primary background, dark mode. Never pure black.
- **Ink Text** (#1E293B light / #F8FAFC dark) — Primary text.
- **Muted Steel** (#64748B) — Secondary text, metadata, timestamps.
- **Whisper Border** (#E2E8F0 at 50% / surface-800 dark) — 1px structural lines.

Status colors (order pills): pending amber, assigned blue, in-transit indigo,
delivered Deep Emerald, cancelled red. Pills are always `rounded-full`, 12px
semibold, tinted background with dark text — never solid-fill pills with white text.

## 3. Typography Rules

- **Display:** Geist — Track-tight (`-0.02em`), semibold/bold, `font-display` class.
  Hierarchy through weight and size steps, not giant leaps. Store names and screen
  titles only.
- **Body:** Geist — Relaxed leading (`1.6`), max 65ch, Muted Steel for secondary.
  All UI copy in Rioplatense-neutral Costa Rican Spanish (voseo: "tocá", "elegí").
- **Mono:** Geist Mono — Money amounts in dense contexts, order IDs (`#A3F2`),
  timestamps, phone numbers. All high-density numbers monospace.
- **Banned:** Inter (present in legacy imports — do not use for new screens),
  generic system stacks for display type, ALL serif fonts in app UI (no editorial
  exception here: this is operations software, not a magazine).

## 4. Component Stylings

- **Buttons:** `rounded-xl`, semibold, Kiwi Deep fill with white text for primary;
  ghost/outline for secondary. Tactile `-translate-y-px` on active. Full-width
  bottom-anchored CTA bar on mobile flows (`sticky bottom-0` with blur backdrop).
  Disabled state at 50% opacity — never hide the button. No outer glows.
- **Step wizards:** 3-step dotted progress (Pedido → Repartidor → Confirmar) with
  green check circles for done, numbered circle for current. Horizontal on mobile,
  never vertical.
- **Order rows:** `rounded-2xl` white/midnight cards, client name left (truncate),
  status pill + chevron right. Tap expands inline detail (timeline, amounts,
  call buttons) — never navigates away for detail.
- **Timelines:** Vertical rail with green check circles (done) vs hollow circles
  (pending), 2px connector line, label + Costa Rica timestamp
  (`timeZone: 'America/Costa_Rica'`, short month + HH:MM).
- **Money:** Always `₡` prefix, thousands separator, Geist Mono in lists. Format:
  `Envío ₡2,000 · Comisión ₡300 · Total ₡2,000`. Trip price in Kiwi Deep.
- **Payment selector:** Two large side-by-side method buttons (Tarjeta | Crédito
  con balance), selected gets Kiwi Deep 2px border. Explanatory microcopy below
  in Muted Steel (what is charged, what happens if balance falls short).
- **Inputs:** Label above, `rounded-xl` border, error text below in red. Search
  inputs with left icon and full-width tap area. Date/time pickers native.
- **Loaders:** Skeleton blocks matching card dimensions with shimmer — no circular
  spinners except full-screen boot (`KiwiLoader`).
- **Empty states:** Composed illustration + one line + primary CTA
  (e.g. "Sin envíos en curso. Todo entregado." + Crear envío). Never bare text.
- **Errors:** Inline red banners with retry button (`Reintentar`), never silent
  zeros. Amount-affecting errors block the CTA, not the whole screen.

## 5. Layout Principles

- Mobile-first single column; merchant dashboard expands to max-width 7xl grid
  on desktop. CSS Grid for multi-column, never flexbox percentage math.
- Order flows use bottom-anchored action bars; content scrolls above them.
- Asymmetric summary blocks: label left in Muted Steel, value right-aligned
  (money in Kiwi Deep semibold, Total row larger).
- Dark mode is a first-class citizen: every surface, border, and text color has
  an explicit dark variant. Test every new screen in both.
- Full-height screens use `min-h-[100dvh]` — never `h-screen` (iOS Safari jump).
- Touch targets minimum 44px. Sticky headers with blur (`glass`/`glass-strong`).
- Maps (Leaflet OSM/CARTO tiles) sit in `rounded-2xl` containers with 16px page
  padding — never full-bleed without radius on mobile.

## 6. Motion & Interaction

- Spring physics default: `stiffness: 260, damping: 20` for micro-interactions,
  `type: 'spring'` page transitions (`opacity 0 → 1`, `scale 0.9 → 1` on success
  screens). No linear easing anywhere.
- Expand/collapse order detail with height + opacity animation (framer-motion
  `AnimatePresence`), chevron rotates 180°.
- Live updates flash the changed row (subtle scale pulse `1 → 1.015 → 1` plus
  Kiwi border) — the user sees what moved without re-reading the list.
- Staggered list entrances (`ScrollReveal`, max 6 indexed cascades).
- Success moments celebrate (delivery confirmation spring + payout display).
- Destructive actions (cancel order) always confirm via native confirm dialog
  with client name + order short ID. No undo-less destroys.
- Animate only `transform` and `opacity`. Isolate heavy animation in client
  components.

## 7. Anti-Patterns (Banned)

- No emojis in UI chrome (success screens and payment icons excepted where
  already established: 🚀 Crear Pedido, 📷 photo upload).
- No Inter, no system-font display type, no serifs in app UI.
- No pure black (`#000000`) — Midnight Canvas only.
- No neon/outer glow shadows; shadows tinted to background hue, diffused.
- No purple/blue gradient aesthetics anywhere.
- No oversaturated accents; single green family plus status colors.
- No gradient text on headers.
- No custom mouse cursors.
- No centered hero sections; no 3-equal-cards feature rows (use lists, staggered
  grids, or horizontal scroll).
- No generic names ("John Doe", "Acme"), no fake round stats.
- No AI copywriting clichés ("seamless", "elevate", "next-gen", "unleash").
- No "Scroll to explore" filler, no bouncing chevrons, no scroll arrows.
- No circular loading spinners for content (skeletons only).
- No silent failures on money or order state — every failure names the retry.
- No `h-screen`, no horizontal overflow on mobile, no tap targets under 44px.
- No English UI strings (copy is es-CR, voseo). No unformatted money or dates.
