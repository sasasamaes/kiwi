# Dual Order (Comida/Encomienda) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merchant creates Comida or Encomienda orders with trip ₡2000 + 10% trip commission pricing, driver assignment (favorites/available/later), and a payment breakdown.

**Architecture:** Backend (`api/src/orders/orders.service.ts`) stays source of truth for pricing and persists new flete fields via a Prisma migration; frontend (`apps/web/app/orders/new/page.tsx`) adds a mode selector, an encomienda variant of step 3, menu-driven quick items, and a final assign step. No new API routes (assign, favorites, available-drivers, my-menu all exist).

**Tech Stack:** NestJS + Prisma (Postgres), Next.js 15 + React 19 + Tailwind, jest (api), tsc + next build (web).

## Global Constraints

- Trip zone stays exactly as implemented: flat ₡2000 within 10 km of Nicoya centro (10.1467, -85.4520), distance table outside.
- Commission is 10% of the trip only; products are 0% pass-through until phase 2.
- Driver payout equals the full trip price.
- No placeholders, no dead mock data, no new dependencies.
- Conventional commits, one commit per task.

---

## File map

- Modify: `api/prisma/schema.prisma` (Order model += 5 fields)
- Create: `api/prisma/migrations/<timestamp>_add_flete_fields/migration.sql` (via migrate dev)
- Modify: `api/src/orders/orders.service.ts` (pricing + persist fields, ~lines 53-81 and 623+)
- Modify: `api/src/__tests__/orders.service.spec.ts` (new describe block)
- Modify: `apps/web/app/orders/new/page.tsx` (mode, step 3 variants, quick items, assign step, payment breakdown)

---

### Task 1: Persist flete fields (Prisma)

**Files:**

- Modify: `api/prisma/schema.prisma` (Order model, after `totalAmount` line ~221)
- Create: migration via CLI

**Interfaces:**

- Consumes: nothing
- Produces: `Order.productsTotal Decimal`, `Order.kind String`, `Order.packageDescription String?`, `Order.packageSize String?`, `Order.declaredValue Decimal?` for Task 2.

- [ ] **Step 1: Add fields to the Order model**

```prisma
  // Flete (fase 1: encomiendas)
  productsTotal      Decimal   @default(0) @map("products_total") @db.Decimal(10, 2)
  kind               String    @default("food") @map("kind")
  packageDescription String?   @map("package_description")
  packageSize        String?   @map("package_size")
  declaredValue      Decimal?  @map("declared_value") @db.Decimal(10, 2)
```

- [ ] **Step 2: Generate and apply the migration**

Run: `cd api && npx prisma migrate dev --name add_flete_fields`
Expected: migration folder created, `prisma generate` runs clean.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/
git commit -m "feat(pricing): persist flete fields on orders"
```

---

### Task 2: Backend pricing (trip + 10%, products pass-through)

**Files:**

- Modify: `api/src/orders/orders.service.ts`
- Test: `api/src/__tests__/orders.service.spec.ts`

**Interfaces:**

- Consumes: `calculateBasePrice()` zone/table logic and `isInNicoyaZone()` from the existing file (unchanged).
- Produces: `create()` returns orders with `basePrice=trip`, `commission=10% trip`, `driverPayout=trip`, `totalAmount=products+trip+commission`; `commissionForProducts()` seam returning 0 for Task 6/fase 2.

- [ ] **Step 1: Write the failing tests** (append inside top-level `describe('OrdersService')`, needs the existing `beforeEach` mocks: `prisma.merchantProfile.findUnique` + `prisma.order.create` mockImplementation returning `{ id: 'order-1', ...data }`)

```ts
describe('flete pricing (trip + 10pct)', () => {
  beforeEach(() => {
    prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'merchant-1',
      userId: 'user-1',
      businessName: 'Soda Nicoya',
    });
    prisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'order-1',
      ...data,
    }));
  });

  it('flete en zona: 2000 + 200, driver recibe 2000', async () => {
    const order: any = await service.create('user-1', {
      pickupAddress: 'Parque Nicoya',
      pickupLat: 10.1467,
      pickupLng: -85.452,
      deliveryAddress: 'Barrio San Martín',
      deliveryLat: 10.15,
      deliveryLng: -85.455,
      distanceKm: 2,
      kind: 'freight',
      packageDescription: 'Caja con repuestos',
      packageSize: 'M',
    });
    expect(order.basePrice).toBe(2000);
    expect(order.commission).toBe(200);
    expect(order.driverPayout).toBe(2000);
    expect(order.totalAmount).toBe(2200);
  });

  it('comida en zona: productos pass-through sin comision', async () => {
    const order: any = await service.create('user-1', {
      pickupAddress: 'Parque Nicoya',
      deliveryAddress: 'Barrio San Martín',
      distanceKm: 2.5,
      kind: 'food',
      productsTotal: 5000,
    });
    expect(order.basePrice).toBe(2000);
    expect(order.commission).toBe(200);
    expect(order.totalAmount).toBe(7200);
  });

  it('rechaza kind invalido y productsTotal negativo', async () => {
    const base = { pickupAddress: 'A', deliveryAddress: 'B' };
    await expect(service.create('user-1', { ...base, kind: 'drone' })).rejects.toThrow(
      'kind inválido',
    );
    await expect(service.create('user-1', { ...base, productsTotal: -100 })).rejects.toThrow(
      'productsTotal inválido',
    );
    expect(prisma.order.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd api && npx jest src/__tests__/orders.service.spec.ts -t "flete pricing"`
Expected: FAIL (unknown `kind` arg ignored, totals still old formula).

- [ ] **Step 3: Implement pricing in `create()`** (replace the block starting `// Calculate pricing based on distance`)

```ts
// Pricing: trip (zone flat or distance table) + 10% trip commission.
// Products pass through with 0% commission until phase 2.
const kind = data.kind ?? 'food';
if (kind !== 'food' && kind !== 'freight') {
  throw new BadRequestException('kind inválido: use food o freight');
}
const productsTotal = Number(data.productsTotal ?? 0);
if (!Number.isFinite(productsTotal) || productsTotal < 0) {
  throw new BadRequestException('productsTotal inválido');
}
const tripPrice = this.calculateBasePrice(
  distanceKm,
  { lat: data.pickupLat, lng: data.pickupLng },
  { lat: data.deliveryLat, lng: data.deliveryLng },
);
const commission = Math.round(tripPrice * 0.1) + this.commissionForProducts(productsTotal);
const driverPayout = tripPrice;
const totalAmount = productsTotal + tripPrice + commission;
```

Persist in the existing `prisma.order.create({ data: { ... } })`: set `basePrice: tripPrice`, `commission`, `driverPayout`, `totalAmount`, plus `productsTotal`, `kind`, `packageDescription: data.packageDescription ?? null`, `packageSize: data.packageSize ?? null`, `declaredValue: data.declaredValue ?? null`. Validate `packageSize`, if present, is one of `S`, `M`, `L` (else `BadRequestException('packageSize inválido')`).

Add the seam method next to `calculateBasePrice`:

```ts
/** Phase-2 seam: commission on products. Currently 0 (merchant keeps 100%). */
private commissionForProducts(_productsTotal: number): number {
  return 0;
}
```

- [ ] **Step 4: Run tests**

Run: `cd api && npx jest src/__tests__/orders.service.spec.ts`
Expected: all PASS (old + new).

- [ ] **Step 5: Type-check**

Run: `cd api && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add api/src/orders/orders.service.ts api/src/__tests__/orders.service.spec.ts
git commit -m "feat(pricing): trip plus 10pct commission with products pass-through"
```

---

### Task 3: Mode selector + encomienda step (frontend)

**Files:**

- Modify: `apps/web/app/orders/new/page.tsx`

**Interfaces:**

- Consumes: Task 2 pricing contract (frontend only estimates; backend recalculates).
- Produces: `orderData.kind: 'food' | 'freight'`, package fields in state, `canProceedStep3` allowing zero items in freight, for Tasks 5-6.

- [ ] **Step 1: Add mode state + package fields to `OrderData`**

```tsx
kind: 'food' | 'freight';
packageDescription: string;
packageSize: '' | 'S' | 'M' | 'L';
declaredValue: number;
```

Init: `kind: 'food', packageDescription: '', packageSize: '', declaredValue: 0`.

- [ ] **Step 2: Render mode selector as the first block of step 1** (two selectable cards, Comida/Encomienda, default food; switching to freight clears `items`, switching to food clears package fields).

- [ ] **Step 3: Branch step 3**: if `kind === 'freight'`, render package form (descripción obligatoria, tamaño S/M/L selector, valor declarado opcional, instrucciones reuse) instead of quick-add/custom/list; if `food`, keep current UI unchanged.

- [ ] **Step 4: Update gating**: step-3 Next disabled when `kind==='food' && items.length===0`, or `kind==='freight' && !packageDescription.trim()`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json` from repo root. Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/orders/new/page.tsx
git commit -m "feat(web): food/freight modes with encomienda step"
```

---

### Task 4: Quick items from the merchant menu

**Files:**

- Modify: `apps/web/app/orders/new/page.tsx`

**Interfaces:**

- Consumes: existing `api.getMyMenuItems()` (`@kiwi/ui` api-client, returns the items array directly — see `apps/web/app/menu/page.tsx:71-72`).
- Produces: quick-add sourced from real menu for Task 6 totals.

- [ ] **Step 1: Fetch menu on mount** (`useEffect`, `api.getMyMenuItems()`, store `items` in state; on failure keep empty list and rely on custom form — never block the wizard).

- [ ] **Step 2: Replace the hardcoded `quickItems` array** with the first 6 available menu items mapped to `{ name, price }`; keep the existing `addQuickItem` logic and custom-item form untouched.

- [ ] **Step 3: Type-check** (same command as Task 3, step 5). Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/orders/new/page.tsx
git commit -m "feat(web): quick items from merchant menu"
```

---

### Task 5: Assign step (favorites / available / later)

**Files:**

- Modify: `apps/web/app/orders/new/page.tsx`

**Interfaces:**

- Consumes: existing `api.getFavoriteDrivers()`, `api.addFavoriteDriver(id)`, `api.removeFavoriteDriver(id)`, `api.getAvailableDrivers(lat?, lng?)`, `api.assignDriver(orderId, driverId)` — all already in `@kiwi/ui` api-client. Driver objects expose `id`, `fullName`, `vehicleType`, `rating`.
- Produces: order created already-assigned, or pending for later.

- [ ] **Step 1: Add post-create assign step.** After `api.createOrder` succeeds, if `selectedDriverId` is set call `api.assignDriver(result.id, selectedDriverId)` before showing success. Include `kind`, `productsTotal` (food subtotal, 0 in freight), and package fields in the `createOrder` payload from Task 3 state.

- [ ] **Step 2: Render the assign UI as the last wizard step before Pay**: three groups — Favoritos (star toggle per driver calling add/remove favorite + refresh), Disponibles (fetched with pickup coords when present), and a selected-by-default "Asignar después" option that skips assignment.

- [ ] **Step 3: Type-check** (same command). Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/orders/new/page.tsx
git commit -m "feat(web): assign favorite or available driver at creation"
```

---

### Task 6: Payment breakdown (Viaje + 10% + Productos)

**Files:**

- Modify: `apps/web/app/orders/new/page.tsx` (step 4 summary + success screen total)

**Interfaces:**

- Consumes: `subtotal` (existing), `tripEstimate = 2000`, `commissionEstimate = round(2000 * 0.10)`.
- Produces: user-visible totals matching the backend contract from Task 2.

- [ ] **Step 1: Replace the price math** (`subtotal/commission/deliveryFee/total` block ~line 147):

```tsx
const subtotal = orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
const tripEstimate = 2000; // zona Nicoya centro; el backend recalcula
const commissionEstimate = Math.round(tripEstimate * 0.1);
const total = subtotal + tripEstimate + commissionEstimate;
```

Show rows: Productos (food only), Viaje, Comisión Kiwi (10%), Total. Replace the "Envío Gratis" row and the stale "Comisión Kiwi (10%)" on-subtotal math. Success screen uses the same `total`.

- [ ] **Step 2: Type-check** (same command). Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/orders/new/page.tsx
git commit -m "feat(web): payment breakdown trip plus commission"
```

---

### Task 7: Verify end-to-end and ship

- [ ] **Step 1: Full backend suite**

Run: `cd api && npx jest src/__tests__/orders.service.spec.ts src/__tests__/orders.integration.spec.ts`
Expected: all PASS.

- [ ] **Step 2: Web build**

Run: `npm run build` in `apps/web` (or `npx tsc --noEmit -p apps/web/tsconfig.json` from root + build). Expected: `/orders/new` builds, no type errors.

- [ ] **Step 3: Manual pass** (dev servers + local DB): create freight order in-zone → backend returns 200/200/2000/2200; create food order with products → total = products + 2200; assign favorite, assign available, assign-later (pending visible in drivers page).

- [ ] **Step 4: Push + deploy both sides** (repo has no auto-deploy: `vercel --prod` from repo root for merchant, Render redeploy for api).

```bash
git push origin main
```
