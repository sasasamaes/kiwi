# Crea tu Bowl (KyL Bowls) — Design

- Date: 2026-10-10
- Status: approved by owner, pending spec review
- Scope: client hero card + merchant-configured product. No API, schema, or picker changes.

## 1. Goal

KyL Bowls' physical flyer ("Crea tu bowl favorito", 4 steps + extras) must be orderable
from the client menu page (`apps/client/app/menu/[id]`). The merchant owns prices and
options; the client shows a fixed, highlighted "Crea tu Bowl" entry that opens the
existing variant picker. Single source of truth: the merchant's product data.

## 2. Non-goals

- No changes to the variant picker modal, cart lines, checkout, or orders API.
- No Prisma migration (the model already supports everything below).
- No changes to the merchant panel (editing already works — verified in
  `apps/web/components/ui/MenuItemForm.tsx`: option name, `priceDelta`, availability
  toggle, add option up to 30 per group, group `maxSelections`).
- No hardcoded prices, options, or merchant IDs in client code.

## 3. Data design (merchant-configured product)

One menu item named `Crea tu Bowl`, base price ₡2900, with 5 variant groups:

| #   | Group    | Type     | Required | Max | Options (priceDelta)                                                                                                                                                                                                                              |
| --- | -------- | -------- | -------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tamaño   | simple   | yes      | —   | Pequeño +0, Mediano +600, Grande +2100                                                                                                                                                                                                            |
| 2   | Base     | simple   | yes      | —   | Açaí +300, Fresa +0, Maracuyá +0, Mora +0, Mango +0, Frutos rojos +300, Pitahaya +0                                                                                                                                                               |
| 3   | Frutas   | multiple | yes      | 3   | Banano, Fresa, Sandía, Uva, Piña, Papaya, Mango, Manzana verde, Kiwi (all +0)                                                                                                                                                                     |
| 4   | Toppings | multiple | yes      | 3   | Hershey's caramelo, Hershey's chocolate, Leche condensada, Mantequilla de maní, Bolitas de chocolate, Bolitas de chocolate blanco, Chispas semiamargo, Maní, Granola, Nutella, Coco, Chía, Almendras, Miel de abeja, Semillas de girasol (all +0) |
| 5   | Extras   | multiple | no       | —   | Arándanos +600, Helado +800, Yogurt +600, Semillas de marañón +650, Nutella +650, 1 topping +500, 1 fruta +500                                                                                                                                    |

Notes:

- Tamaño is modeled as deltas over the ₡2900 base (Pequeño 2900 / Mediano 3500 /
  Grande 5000). `unitPriceFor` already computes base + deltas; no code change.
- Frutas/Toppings `maxSelections: 3` is enforced client-side (picker blocks the 4th)
  and server-side (`orders.service.ts` throws past the cap). Extras is the paid path
  to a 4th fruit/topping, exactly like the flyer.
- Nutella intentionally appears in both Toppings (+0) and Extras (+650), per flyer.

## 4. Client design (fixed entry, data-driven content)

- In `apps/client/app/menu/[id]/page.tsx`, when the viewed merchant's already-fetched
  items include a personalizable item whose name matches `/crea tu bowl/i`, render a
  fixed hero card ("Crea tu Bowl", distinct styling) above the regular item list.
- Tapping it calls the existing `addToCart(item)` → opens the existing picker modal
  with required-group validation, sold-out handling, and `(x de 3)` counters.
- If no such product exists for the merchant, no card renders. Prices/options are
  never hardcoded; the card only fixes placement and styling.
- The regular list keeps its existing "Personalizable" chip behavior unchanged.
- No merchant-ID constant: the rule is name + personalizable within the merchant
  being viewed. Today only KyL Bowls will have such a product.

## 5. Merchant editing (requirement, zero code)

KyL edits prices and adds/removes options in its panel; changes flow through the
existing product API to the client picker with no deploy. Availability toggle
(`isAvailable`) pauses an option same-day (picker blocks it, shows "Agotado" path).

## 6. Initial data load (ops, not code)

The merchant loads the §3 table once via its panel. No seed script ships with this
change; the card appears as soon as the product exists and the client deploys.

## 7. Error handling (existing, reused)

- Missing required group → picker error naming the group; confirm blocked.
- All options of a required group sold out → "Agotado" message; confirm blocked.
- 4th pick in a capped group → blocked client-side; server rejects past-cap orders.
- Closed merchant → `+` disabled (existing behavior).

## 8. Testing

- API: existing suites already cover the lifecycle (`driver-merchant-flow`), max cap,
  and proof-photo paths — 38 suites / 399 tests green at last verification.
- Client: `apps/client` has no test runner today, so no new automated client test
  ships here; verification is `tsc --noEmit`, full API suite, and a manual checklist
  (card visible only with product, picker requires tamaño/base/frutas/toppings,
  4th fruit blocked, extras add correctly, order reaches merchant with variants).
- Adding a client test runner is explicitly out of scope.

## 9. Rollout

1. Deploy client with hero card (inert until product exists).
2. Merchant loads "Crea tu Bowl" per §3.
3. Smoke-test one bowl end-to-end on production menu.

## 10. Decisions (all resolved)

- Panel-vs-code → fixed client entry, merchant-owned data (owner, 2026-10-10).
- Data source → flyer content as configured product, not hardcoded (owner, 2026-10-10).
- Merchant editing → required, already supported, no code (owner, 2026-10-10).
