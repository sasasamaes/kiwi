# Design System: Kiwi Delivery — Tropical Pura Vida Night

## 1. Visual Theme & Atmosphere

A **Cockpit-Dense** mobile-first delivery interface built for **outdoor readability** under Guanacaste's harsh sunlight. The atmosphere is **confident tropical minimalism** — deep midnight slate surfaces provide high-contrast canvas for electric botanical green accents that pulse with the energy of a rainforest canopy at dusk.

**Density: 8/10** — Drivers need information density while riding. Every pixel earns its place. Cards are replaced with border-top dividers. Numbers are always monospace. Status badges are compact, high-signal.

**Variance: 8/10** — Asymmetric layouts throughout. Hero sections are left-aligned, never centered. Order cards use offset grid. Earning summaries break the 3-column equal-card pattern with oversized primary numbers flanked by compact metadata.

**Motion: 6/10** — Fluid CSS transitions with spring physics. Status changes cascade with staggered reveals. The online/offline toggle pulses with perpetual micro-animation. Order cards slide in from edges on Socket.io updates. No cinematic sequences — drivers need instant feedback, not theater.

The visual language marries **deep dark glassmorphism** with **luminous kiwi-green accents**. Surfaces mimic smoky translucent foliage. The aesthetic is tropical rainforest under starlight — exotic, invigorating, serene.

## 2. Color Palette & Roles

- **Midnight Canvas** (`#0b1326`) — Primary background surface. Deep slate, never pure black. The night sky of Nicoya.
- **Frosted Surface** (`rgba(30, 41, 59, 0.75)`) — Card and container fill with `backdrop-filter: blur(20px)`. Translucent glass that lets the canvas breathe.
- **Deep Slate Border** (`rgba(51, 65, 85, 0.6)`) — Structural separation lines. Hair-thin, 1px, semi-transparent.
- **Canopy White** (`#f8fafc`) — Primary text on dark surfaces. Crisp slate-100 for immediate readability under sunlight.
- **Muted Fern** (`#94a3b8`) — Secondary text, descriptions, metadata. Slate-400 for non-critical information.
- **Kiwi Leaf** (`#22c55e`) — Primary accent. The brand signature. Used for: CTAs, active states, focus rings, online indicators, success badges, primary buttons. Saturation controlled — vibrant but not neon.
- **Lime Pulse** (`#4ade80`) — Secondary accent. Hover states, focus rings, active highlights, secondary badges. Softer energy than Kiwi Leaf.
- **Deep Emerald** (`#10b981`) — Tertiary accent. Grounding contrast for complex data visualizations, success confirmations, atmospheric glow gradients.
- **Sunburst Amber** (`#f59e0b`) — Utility accent. Star ratings, promotional highlights, urgency badges ("Ultimos pedidos del dia"), express delivery accents.
- **SINPE Blue** (`#0284c7`) — Cultural accent. Costa Rica's native peer-to-peer mobile banking. Payment badges, quick-copy account numbers.
- **Error Crimson** (`#ffb4ab`) — Error states, destructive actions, critical alerts. High contrast on dark surfaces.
- **Error Container** (`#93000a`) — Error background fills. Deep red with text `#ffdad6`.

**Banned:** Pure black (`#000000`), purple/neon glows, oversaturated gradients, warm/cool gray fluctuation.

## 3. Typography Rules

- **Display:** `Geist` — Track-tight (`letter-spacing: -0.03em`), weight-driven hierarchy (700 for headlines, 800 for currency). Not screaming. The Punchy Architectural presence.
- **Headlines:** `Geist` — Sizes: 32px (lg), 24px (md), 20px (sm). Weight 600-700. Tight negative tracking for visual density.
- **Body:** `Inter` — Relaxed leading (1.5-1.6), 65ch max-width for readability. Used for descriptions, form labels, helper text. Weight 400.
- **Labels:** `Geist` — Uppercase transform with positive tracking (+0.04em to +0.06em). Sizes: 13px (md), 11px (sm). Status tags ("EN CAMINO"), distance markers ("A 1.2 KM"), legal disclaimers.
- **Mono:** `JetBrains Mono` — All numbers, currency, timestamps, earnings, distances. Tabular figures for vertical alignment. When density exceeds 7, ALL numbers use monospace.
- **Banned:** Inter for display/headlines (use Geist instead). Generic serif fonts (Times New Roman, Georgia, Garamond). System fonts for premium contexts.

## 4. Component Stylings

- **Primary Button ("Pedir Ahora", "Confirmar SINPE"):** Solid Kiwi Leaf background (`#22c55e`), white text, font-weight 700, height 52px (mobile touch standard), pill shape (`border-radius: 9999px`). Tactile -1px translate on active. Kiwi ambient glow: `0 8px 20px -4px rgba(34, 197, 94, 0.35)`. No neon outer glow. No custom mouse cursors.
- **Secondary/Ghost Button ("Ver detalles", "Modificar"):** Background `rgba(34, 197, 94, 0.1)`, text `#4ade80`. Border transparent at rest, `rgba(34, 197, 94, 0.3)` on hover. Tactile feedback on press.
- **Glass Cards (Order tiles, Store items):** Background `rgba(30, 41, 59, 0.75)`, `backdrop-filter: blur(20px)`, border `1px solid rgba(51, 65, 85, 0.6)`. Corner radius 16px. Shadow: `0 10px 30px -10px rgba(0, 0, 0, 0.5)`. Interactive cards feature subtle top border highlight gradient. High-density layouts: replace with border-top dividers.
- **Elevated Panels (Modals, Active SINPE Drawer):** Background `rgba(51, 65, 85, 0.8)`, `backdrop-filter: blur(24px)`. Border `1px solid rgba(74, 222, 128, 0.2)`. Shadow: `0 25px 50px -12px rgba(0, 0, 0, 0.7)`.
- **Input Fields:** Background `rgba(15, 23, 42, 0.6)`, border `rgba(51, 65, 85, 0.8)`, text `#f8fafc`, placeholder `#64748b`. Height 48px. Focus: border shifts to `#22c55e` with ambient ring `0 0 0 3px rgba(34, 197, 94, 0.2)`. Label above, error below. No floating labels.
- **Chips & Filter Pills:** Default: `rgba(30, 41, 59, 0.8)` background, `#94a3b8` text, `1px solid rgba(51, 65, 85, 0.6)`. Active: `#22c55e` background with deep slate text, or transparent with solid `#22c55e` border and glowing dot prefix. Fully rounded pill shape.
- **Status Badges:** Compact, uppercase labels. "EN CAMINO" in Kiwi Leaf with dark text. "ENTREGADO" in Emerald. "PENDIENTE" in Amber. Monospace font at 11px.
- **SINPE Payment Slip Card:** Specialized glass card displaying merchant phone, destination owner name, instant 1-tap "Copiar Numero" button. File upload pill for attaching payment proof screenshots.
- **Currency Display:** Always monospace (`JetBrains Mono`), weight 800, size 22px. Tabular figures for vertical alignment. Colón glyph (`₡`) styled alongside bold numbers.
- **Loaders:** Skeletal shimmer matching exact layout dimensions — no generic circular spinners. Pulse animation on skeleton placeholders.
- **Empty States:** Composed, illustrated compositions indicating how to populate data — not just "No data" text.

## 5. Layout Principles

- **No overlapping elements** — every element occupies its own clear spatial zone. No absolute-positioned content stacking.
- **Centered Hero sections are BANNED** — force Left-Aligned or Asymmetric Whitespace for all landing pages and onboarding flows.
- **The generic "3 equal cards horizontally" feature row is BANNED** — use 2-column Zig-Zag, asymmetric grid, or horizontal scroll for restaurant listings.
- **CSS Grid over Flexbox math** — never use `calc()` percentage hacks.
- **Contain layouts** using max-width constraints (1280px centered for desktop, 390px for mobile).
- **Full-height sections** must use `min-h-[100dvh]` — never `h-screen` (iOS Safari catastrophic jump).
- **Mobile Viewport (360px–640px):** Margins 16px (`margin-mobile`), gutter 12-16px. Floating bottom navigation with safe-area inset padding.
- **Tablet (641px–1024px):** 8-column layout. Centered max container 720px for ordering flows.
- **Desktop (1025px+):** 12-column fluid grid capped at 1200px. Fixed sidebar navigation (260px) with fluid content space.
- **Touch Targets:** All interactive elements minimum 44px tap target — drivers wearing gloves need generous hit areas.

## 6. Motion & Interaction

- **Spring Physics default:** `stiffness: 100, damping: 20` — premium, weighty feel. No linear easing. Every interactive element uses spring-based transitions.
- **Perpetual Micro-Interactions:**
  - Online/Offline toggle: Green pulse indicator with infinite loop when connected
  - QR Scanner button: Subtle floating animation (translateY oscillation)
  - Order status badges: Gentle shimmer highlight sweep
  - Earning counters: Typewriter effect on value change
  - Bottom nav active icon: Soft bounce on tab switch
- **Staggered Orchestration:** Never mount lists instantly — use cascade delays (50ms increment) for waterfall reveals on order cards, restaurant tiles, and notification lists.
- **Socket.io Transitions:** New orders slide in from the right edge with spring physics. Completed orders fade out with scale-down. Status changes cross-fade with 200ms transition.
- **Performance:** Animate exclusively via `transform` and `opacity`. Never animate `top`, `left`, `width`, `height`. Grain/noise filters on fixed pseudo-elements only. Isolated Client Components for CPU-heavy animations.
- **Driver Outdoor Mode:** When app detects bright ambient light (via device sensor), increase transition durations by 20% for better visibility during motion.

## 7. Anti-Patterns (Banned)

- No emojis anywhere in the UI (including empty states, loading screens, notifications)
- No `Inter` for display or headlines — use `Geist` for all typographic hierarchy
- No generic serif fonts (Times New Roman, Georgia, Garamond, Palatino) — distinctive modern serifs only if editorial context demands it, never in dashboards
- No pure black (`#000000`) — use Midnight Canvas (`#0b1326`) or Zinc-950
- No neon/outer glow shadows — use tinted ambient glows with low opacity
- No oversaturated accents — Kiwi Leaf at controlled saturation, not electric green
- No excessive gradient text on large headers — flat color with weight-driven hierarchy
- No custom mouse cursors
- No overlapping elements — clean spatial separation always
- No 3-column equal card layouts — use asymmetric grids or horizontal scroll
- No generic placeholder names ("John Doe", "Acme", "Nexus") — use Costa Rican names: Luis Alfredo, Juan Carlos, Fran, Punto Acido, Los Efes
- No fake round numbers (`99.99%`, `50%`) — use realistic data: 4.8 stars, 156 viajes, ₡11,590
- No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen") — use natural Costa Rican Spanish: "Pura Vida", "Del parque 100m norte", "Ya va en camino"
- No filler UI text: "Scroll to explore", "Swipe down", scroll arrows, bouncing chevrons
- No broken Unsplash links — use `picsum.photos` or SVG avatars
- No centered Hero sections — left-aligned or asymmetric for all first impressions
- No generic loading spinners — skeletal shimmer matching layout dimensions
- No "No data found" empty states — composed illustrations with clear CTAs
