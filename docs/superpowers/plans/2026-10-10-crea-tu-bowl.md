# Crea tu Bowl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a fixed "Crea tu Bowl" hero card on the client menu page that opens the existing variant picker for the merchant's configured product.

**Architecture:** Zero API/schema changes. One file changed (`apps/client/.../menu/[id]/page.tsx`): derive the builder product from already-fetched items, render a hero card, reuse `addToCart` → picker → cart → checkout untouched. Product data is loaded once via the merchant panel (ops task).

**Tech Stack:** Next.js client component, Tailwind, framer-motion, `@kiwi/ui` (`TapButton`, `api`, `MenuItem`), existing picker state.

## Global Constraints

- No Prisma migration; the variant-group model already supports required/simple/multiple/maxSelections/priceDelta.
- No prices, options, or merchant IDs hardcoded in client code.
- Merchant edits prices/options in its panel; no deploy needed for data changes.
- `apps/client` has no test runner — verification is `tsc --noEmit` + API suite + manual checklist (spec §8).
- Follow existing card/chip patterns in the same file (no new design language).

---

## File structure

- Modify: `apps/client/app/menu/[id]/page.tsx`
  - Add `builderItem` derivation (after `filteredItems`, ~line 415): find personalizable item named like "crea tu bowl".
  - Add `visibleItems` (filtered list minus builder item, to avoid showing it twice).
  - Render hero card between the Category Filter block (~line 904) and the Menu Items block (~line 906).
  - Reuse `addToCart(builderItem)` and the `merchant.isOpen` disabled rule. No other logic changes.
- No new files. No API/package changes.

---

### Task 1: Builder hero card in client menu page

**Files:**

- Modify: `apps/client/app/menu/[id]/page.tsx` (selector ~line 415, hero JSX ~line 906, list map ~line 932)

**Interfaces:**

- Consumes: `menuItems: MenuItem[]`, `selectedCategory: string`, `filteredItems`, `addToCart(item: MenuItem)`, `merchant?.isOpen`, `TapButton`, `hoverCard`.
- Produces: `builderItem: MenuItem | undefined`, `visibleItems: MenuItem[]` used by the list render.

- [ ] **Step 1: Confirm the before-state**

Run: `npx tsc --noEmit -p tsconfig.json` in `apps/client`
Expected: exit 0 (baseline green; the page has no builder card yet).

- [ ] **Step 2: Add the selector + filtered list (after `filteredItems`, line 412-415)**

```tsx
// Builder "Crea tu Bowl": producto personalizable del comercio cuyo nombre
// matchea. Sin hardcodear IDs ni precios: todo sale de menuItems ya cargados.
const builderItem = menuItems.find(
  (item) =>
    /crea tu bowl/i.test(item.name) && (item.variantGroups ?? []).some((g) => g.options.length > 0),
);
// El builder vive en la hero card; no se repite en la lista normal.
const visibleItems = builderItem
  ? filteredItems.filter((item) => item.id !== builderItem.id)
  : filteredItems;
```

- [ ] **Step 3: Render the hero card (between Category Filter `</motion.div>` line 904 and `{/* Menu Items */}` line 906)**

```tsx
{
  /* Builder hero: solo si el comercio cargó el producto "Crea tu Bowl" */
}
{
  builderItem && selectedCategory === 'Todos' && (
    <motion.div
      className="mx-auto max-w-lg px-4 mb-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <div
        className={`rounded-2xl bg-kiwi-700 dark:bg-kiwi-800 p-5 shadow-soft dark:shadow-dark text-white ${hoverCard}`}
      >
        <p className="font-display text-lg font-bold">Crea tu Bowl</p>
        <p className="text-sm text-white/80 mt-1">
          Elegí tamaño, base, 3 frutas, 3 toppings y extras
        </p>
        <div className="flex items-center justify-between mt-3">
          <p className="text-lg font-bold">Desde ₡{builderItem.price.toLocaleString()}</p>
          <TapButton
            haptic
            className="inline-flex min-h-[44px] items-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-kiwi-800"
            onClick={() => addToCart(builderItem)}
            disabled={!merchant?.isOpen}
          >
            Armar el mío +
          </TapButton>
        </div>
      </div>
    </motion.div>
  );
}
```

Rules baked in: card hidden when the product is missing; shown only on "Todos"
so category filtering stays predictable; `+` disabled when the merchant is closed
(same rule as regular cards, which use `disabled={!merchant.isOpen}`); tap reuses
`addToCart` so required-group defaults + picker modal behave identically.

- [ ] **Step 4: Point the list at `visibleItems`**

Replace the two uses of `filteredItems` in the list block with `visibleItems`:
line 913 `{filteredItems.length === 0 ? (` → `{visibleItems.length === 0 ? (`
line 932 `{filteredItems.map((item, itemIndex) => {` → `{visibleItems.map((item, itemIndex) => {`
Nothing else in the item card changes.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json` in `apps/client`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/client/app/menu/[id]/page.tsx"
git commit -m "feat(client): hero card Crea tu Bowl sobre producto configurable"
```

---

### Task 2: Load the "Crea tu Bowl" product (ops, merchant panel — no code)

**Files:** none (panel UI + existing product API).

**Interfaces:**

- Consumes: spec `docs/superpowers/specs/2026-10-10-crea-tu-bowl-design.md` §3 (exact groups/options/prices).
- Produces: product visible in client menu with 5 variant groups; hero card appears.

- [ ] **Step 1: Create the product in KyL Bowls' panel**

New menu item: name exactly `Crea tu Bowl`, base price `2900`, category `Bowls`,
available. Then add 5 variant groups exactly as spec §3:
Tamaño (simple, required: Pequeño +0, Mediano +600, Grande +2100);
Base (simple, required: Açaí +300, Frutos rojos +300, Fresa/Maracuyá/Mora/Mango/Pitahaya +0);
Frutas (multiple, required, máx 3, all +0: Banano, Fresa, Sandía, Uva, Piña, Papaya, Mango, Manzana verde, Kiwi);
Toppings (multiple, required, máx 3, all +0: the 15 from the flyer);
Extras (multiple, optional: Arándanos +600, Helado +800, Yogurt +600, Semillas de marañón +650, Nutella +650, 1 topping +500, 1 fruta +500).

- [ ] **Step 2: Verify the card appears**

Open the KyL Bowls menu in the client app. Expected: hero card "Crea tu Bowl / Desde ₡2.900"
above the list; tapping "Armar el mío +" opens the picker with the 5 groups and
`(0 de 3)` counters on Frutas/Toppings. No commit (no code changed).

---

### Task 3: Final verification gate

**Files:** none.

- [ ] **Step 1: Type-checks**

Run in each dir, expect exit 0:
`apps/client`: `npx tsc --noEmit -p tsconfig.json`
`api`: `npx tsc --noEmit -p tsconfig.json`

- [ ] **Step 2: API suite (server still enforces caps/extras pricing)**

Run: `npm test` in `api`
Expected: 38 suites / 399 tests PASS (covers lifecycle, max cap, proof-photo).

- [ ] **Step 3: Manual checklist on the KyL Bowls menu**

Card visible only when the product exists; picker blocks confirm until
tamaño + base + 3 frutas + 3 toppings chosen; 4th fruta/topping blocked with
counter at `(3 de 3)`; extras add ₡600/800/650/500 correctly; order reaches the
merchant with variants; closed-merchant disables the hero `+`. No commit.
