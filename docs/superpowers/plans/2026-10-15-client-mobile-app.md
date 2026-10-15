# Kiwi Clientes — App móvil nativa (Expo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la app nativa iOS+Android de Kiwi Clientes (Expo + TS + NativeWind): descubrir/QR, menú, carrito, checkout (SINPE/tarjeta/efectivo/crypto), tracking con mapa, historial+calificación, seguir comercios, push, guest-first y offline-first.

**Architecture:** Se extraen los módulos puros y probados de Repartidores a un paquete compartido `packages/mobile-core` (http client, cola offline, realtime) y se reusa `packages/mobile-ui`. `apps/client-mobile` (Expo Router) consume ambos. La lógica no-UI (carrito, idempotencia, cola, parser de deep link, ETA) se escribe pura y testeable en Node.

**Tech Stack:** Expo SDK 57 · Expo Router · TypeScript strict · NativeWind v4 · TanStack Query · Zustand · expo-sqlite · expo-secure-store · expo-web-browser · expo-camera · expo-notifications · MapLibre (`@maplibre/maplibre-react-native`) · socket.io-client · jest + jest-expo + @testing-library/react-native · EAS.

## Global Constraints

- Node **>= 20**; **Expo SDK 57** (igual que `packages/mobile-ui` y `apps/driver-mobile`): react 19.2.x, react-native 0.86.x.
- Plataformas: **iOS + Android desde el día 0**.
- Estilos: **NativeWind**; tokens de `packages/mobile-ui` (derivados de `docs/DESIGN.md`).
- Reutilización: `packages/mobile-ui`, `packages/mobile-core`, `@kiwi/types`, `@kiwi/i18n`. **NO** `packages/ui` (web).
- HTTP vía `src/api` (basado en `mobile-core`); token **opcional** en **expo-secure-store** (guest sin token).
- Lógica testeable en Node: carrito, idempotencia, cola, parser de deep link, ETA, `mobile-core` — sin módulos nativos (interfaces inyectadas).
- **Sin secretos** en el repo. Commits **conventional**, sin atribución a IA.
- Idempotencia: **una key nueva por pedido**; reusar solo al reintentar el mismo pedido.
- Endpoints guest: `POST /orders` (con `Idempotency-Key`), `POST /payments` guest, menú/geocoding públicos.

---

## File Structure

```
packages/mobile-core/            # NUEVO — lógica pura compartida (extraída de driver-mobile)
  package.json tsconfig.json jest.config.js
  src/http.ts                    # createHttp + HttpError (idéntico al de driver-mobile)
  src/queue/types.ts src/queue/memory-store.ts src/queue/engine.ts src/queue/sync.ts
  src/realtime/socket.ts
  src/index.ts
  src/__tests__/*.test.ts        # se mueven los tests existentes

packages/mobile-ui/              # EXTENDER
  src/components/QtyStepper.tsx src/components/Price.tsx (+ tests)

apps/client-mobile/
  app.json eas.json package.json babel/metro/tailwind/global.css/tsconfig/jest
  app/_layout.tsx app/index.tsx
  app/(public)/comercios.tsx           # discover (home)
  app/(public)/scan.tsx                # QR scanner (expo-camera)
  app/(public)/menu/[id].tsx           # menú + carrito
  app/(public)/checkout.tsx            # checkout
  app/(public)/tracking/[id].tsx       # tracking + mapa
  app/(public)/rate/[id].tsx           # calificación
  app/(account)/orders.tsx app/(account)/profile.tsx app/(auth)/login.tsx app/(auth)/register.tsx
  src/api/http.ts                      # instancia sobre mobile-core (token opcional)
  src/api/storage.ts src/api/menu.ts src/api/orders.ts src/api/payments.ts
  src/api/geocoding.ts src/api/follows.ts src/api/ratings.ts src/api/notifications.ts
  src/cart/store.ts src/cart/math.ts
  src/order/idempotency.ts             # key por pedido (puro)
  src/order/queue.ts                   # cola de creación de pedido (mobile-core)
  src/payments/returnLink.ts           # parser del deep link de retorno (puro)
  src/payments/checkout.ts             # expo-web-browser + polling
  src/tracking/eta.ts                  # ETA (puro)
  src/realtime/* (usa mobile-core)
  src/components/TrackingMap.tsx       # MapLibre
  src/session/store.ts src/session/useSession.ts
  src/notifications/register.ts
  README.md
```

---

### Task C1: `packages/mobile-core` — extraer la lógica pura compartida y apuntar `driver-mobile` a él

**Files:**

- Create: `packages/mobile-core/package.json`, `tsconfig.json`, `jest.config.js`, `src/index.ts`
- Move (copy): `apps/driver-mobile/src/api/http.ts` → `packages/mobile-core/src/http.ts`
- Move: `apps/driver-mobile/src/queue/{types,memory-store,engine,sync}.ts` → `packages/mobile-core/src/queue/`
- Move: `apps/driver-mobile/src/realtime/socket.ts` → `packages/mobile-core/src/realtime/`
- Move tests: `apps/driver-mobile/src/**/__tests__/{http,engine,sync,socket}.test.ts` → `packages/mobile-core/src/__tests__/`
- Modify: `apps/driver-mobile/src/**` imports to `import { ... } from '@kiwi/mobile-core'`

**Interfaces:**

- Produces: `@kiwi/mobile-core` exporting `createHttp`, `HttpError`, `Http`, `createMemoryStore`, `createQueueEngine`, `drainQueue`, `Op`, `OpKind`, `QueueStore`, `createRealtime`, `RealtimeHandlers`.

- [ ] **Step 1: package.json**

```json
{
  "name": "@kiwi/mobile-core",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "type-check": "tsc --noEmit", "test": "jest" },
  "devDependencies": {
    "@types/jest": "~29.5.14",
    "jest": "^29.7.0",
    "jest-expo": "~57.0.6",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: tsconfig + jest**

`tsconfig.json`: extiende `../../tsconfig.json`, `noEmit`, `include: ["src"]`.
`jest.config.js`: `{ "preset": "jest-expo", "testMatch": ["**/__tests__/**/*.test.ts"] }` (si `jest-expo` trae RN de más, usar `preset: undefined` + `testEnvironment: "node"` — los módulos son puros).

- [ ] **Step 3: copiar módulos**

Copiar tal cual (este código ya existe y pasa sus tests en `driver-mobile`):

- `http.ts` (`createHttp`, `HttpError`, `Http`)
- `queue/types.ts`, `queue/memory-store.ts`, `queue/engine.ts`, `queue/sync.ts`
- `realtime/socket.ts`

`src/index.ts`:

```ts
export * from './http';
export * from './queue/types';
export { createMemoryStore } from './queue/memory-store';
export { createQueueEngine } from './queue/engine';
export { drainQueue } from './queue/sync';
export { createRealtime } from './realtime/socket';
export type { RealtimeHandlers } from './realtime/socket';
```

- [ ] **Step 4: mover tests y correrlos en mobile-core**

Mover `http/engine/sync/socket` tests; ajustar imports a `../http`, `../queue/...`, `../realtime/socket`.
Run: `npm --workspace @kiwi/mobile-core run test`
Expected: PASS (1 + 3 + 3 + 1 = 8 tests).

- [ ] **Step 5: apuntar `driver-mobile` a `@kiwi/mobile-core`**

- `apps/driver-mobile/package.json`: agregar `"@kiwi/mobile-core": "*"` a deps.
- En `apps/driver-mobile`, reemplazar imports locales por `@kiwi/mobile-core` y **borrar** los archivos movidos (`src/api/http.ts`, `src/queue/{types,memory-store,engine,sync}.ts`, `src/realtime/socket.ts`) y sus tests locales. Ajustar `src/api/client.ts`, `src/queue/useQueue.ts`, `app/(app)/index.tsx`, `app/(app)/order/[id].tsx` según haga falta.

- [ ] **Step 6: verificar driver sigue verde**

Run: `npm --workspace @kiwi/driver-mobile run type-check && npm --workspace @kiwi/driver-mobile run test`
Expected: tsc 0; tests verdes (los que quedan en driver + los que se movieron ya no cuentan dos veces). Ajustar el conteo esperado: driver debería bajar a ~15 tests (los 8 migran).

- [ ] **Step 7: Commit**

```bash
git add packages/mobile-core apps/driver-mobile package.json package-lock.json
git commit -m "refactor(mobile-core): extract shared http/queue/realtime modules"
```

---

### Task C2: `mobile-ui` — `QtyStepper` y `Price`

**Files:**

- Create: `packages/mobile-ui/src/components/QtyStepper.tsx`, `Price.tsx`
- Modify: `packages/mobile-ui/src/index.ts`
- Test: `packages/mobile-ui/src/__tests__/QtyStepper.test.tsx`

**Interfaces:**

- Produces: `QtyStepper({ value, min?, max?, onChange })`; `Price({ amount, size? })` (formatea ₡ con miles).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { QtyStepper } from '../components/QtyStepper';
test('increments and decrements within bounds', () => {
  const onChange = jest.fn();
  const { getByLabelText } = render(<QtyStepper value={1} min={0} max={2} onChange={onChange} />);
  fireEvent.press(getByLabelText('aumentar'));
  expect(onChange).toHaveBeenCalledWith(2);
  fireEvent.press(getByLabelText('disminuir'));
  expect(onChange).toHaveBeenCalledWith(0);
});
```

- [ ] **Step 2: Run to fail** — `npm --workspace @kiwi/mobile-ui run test -- QtyStepper` → FAIL.

- [ ] **Step 3: Implement**

```tsx
// QtyStepper.tsx
import { Pressable, Text, View } from 'react-native';
import { tokens } from '../theme';
export function QtyStepper({
  value,
  min = 0,
  max = 99,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="disminuir"
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text style={{ color: tokens.color.ink, fontSize: 22 }}>−</Text>
      </Pressable>
      <Text style={{ color: tokens.color.ink, minWidth: 20, textAlign: 'center' }}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="aumentar"
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <Text style={{ color: tokens.color.ink, fontSize: 22 }}>+</Text>
      </Pressable>
    </View>
  );
}
```

```tsx
// Price.tsx
import { Text } from 'react-native';
import { tokens } from '../theme';
export function Price({ amount, size = 16 }: { amount: number; size?: number }) {
  const n = Number.isFinite(amount) ? amount : 0;
  return (
    <Text style={{ color: tokens.color.ink, fontSize: size, fontWeight: '700' }}>
      {'₡' + n.toLocaleString('es-CR')}
    </Text>
  );
}
```

Modify `src/index.ts` to export both.

- [ ] **Step 4: Run + type-check + commit**
      Run: `npm --workspace @kiwi/mobile-ui run test -- QtyStepper && npm --workspace @kiwi/mobile-ui run type-check`

```bash
git add packages/mobile-ui && git commit -m "feat(mobile-ui): QtyStepper and Price components"
```

---

### Task C3: Scaffold `apps/client-mobile`

**Files:** `apps/client-mobile/**` (scaffold como driver: package.json, app.json, tsconfig, babel/metro/tailwind, global.css, app/_layout.tsx, app/index.tsx)

**Interfaces:**

- Consumes: `@kiwi/mobile-ui`, `@kiwi/mobile-core`.

- [ ] **Step 1: Scaffold** (desde `apps/`)

```bash
npx create-expo-app@latest client-mobile --template blank-typescript --no-install
```

Luego wire Expo Router + NativeWind (v4.2.7 + tailwind 3.4) igual que `apps/driver-mobile` (copiar configs y adaptar `app.json`: name "Kiwi Clientes", slug `kiwi-clientes`, scheme `kiwicliente`, android package `express.kiwicr.cliente`, plugins `expo-router`, `expo-secure-store`, `expo-sqlite`, `expo-camera` (con permiso de cámara), `expo-image-picker`, `expo-notifications`).

- [ ] **Step 2: deps** (root install)
      `@kiwi/mobile-ui`, `@kiwi/mobile-core`, `@kiwi/types`, `@kiwi/i18n`; devDeps: jest, jest-expo, @types/jest, @testing-library/react-native@^13.3.3, react-test-renderer@19.2.3 (alineado).

- [ ] **Step 3: placeholder screen** `app/index.tsx` → `<Screen><Text style={{color:tokens.color.ink}}>Kiwi Clientes</Text></Screen>` + `app/_layout.tsx` con providers (QueryClient + SafeAreaProvider).

- [ ] **Step 4: verify** `npm --workspace @kiwi/client-mobile run type-check` → 0; `npx expo config --type public --json` → OK.

- [ ] **Step 5: commit** `git commit -m "chore(client-mobile): scaffold Expo Router app with NativeWind and shared UI"`

---

### Task C4: API client + módulos de dominio

**Files:**

- `apps/client-mobile/src/api/storage.ts` (TokenStorage opcional; `getAccess` puede ser null)
- `apps/client-mobile/src/api/http.ts` (instancia sobre `createHttp` de mobile-core; `refresh` usa `/auth/refresh`)
- `apps/client-mobile/src/api/menu.ts`, `orders.ts`, `payments.ts`, `geocoding.ts`, `follows.ts`, `ratings.ts`, `notifications.ts`
- Test: `apps/client-mobile/src/api/__tests__/orders.test.ts`

**Interfaces:**

- Produces:
  - `menuApi(http)`: `discover()`, `publicProfile(id)`, `items(id, category?)`, `tomorrow(city?)`
  - `ordersApi(http)`: `createAuthed(body, idempotencyKey)`, `createGuest(body, idempotencyKey)`, `mine()`, `get(id)`
  - `paymentsApi(http)`: `createAuthed(body)`, `createGuest(body)`, `status(orderId)`
  - `geocodingApi(http)`: `search(q, limit?)`, `searchNicoya(q, limit?)`, `reverse(lat,lng)`, `nearestZone(lat,lng)`
  - `followsApi(http)`: `follow(merchantId)`, `unfollow(merchantId)`, `mine()`
  - `ratingsApi(http)`: `create(orderId, body)`
  - `notificationsApi(http)`: `registerDevice(token, platform)`

- [ ] **Step 1: Write the failing test**

```ts
import { ordersApi } from '../orders';
const fake = { get: jest.fn(), post: jest.fn(), put: jest.fn(), postMultipart: jest.fn() } as any;
test('guest order posts Idempotency-Key via header path', async () => {
  await ordersApi(fake).createGuest({ merchantId: 'm1' }, 'key-1');
  expect(fake.post).toHaveBeenCalledWith(
    '/orders/guest',
    { merchantId: 'm1' },
    { headers: { 'Idempotency-Key': 'key-1' } },
  );
});
test('authed order posts to /orders with the same header contract', async () => {
  await ordersApi(fake).createAuthed({ merchantId: 'm1' }, 'key-2');
  expect(fake.post).toHaveBeenCalledWith(
    '/orders',
    { merchantId: 'm1' },
    { headers: { 'Idempotency-Key': 'key-2' } },
  );
});
```

> Nota: para soportar el header `Idempotency-Key`, extender `createHttp` en `mobile-core` con un 4º argumento opcional `opts?: { headers?: Record<string,string> }` en `post/put` (cambio aditivo; actualizar el test de `mobile-core` correspondiente). Si se prefiere no tocar core, enviar la key en el body (`idempotencyKey`) como hace la PWA — decidir y ser consistente con la API (el controller acepta ambos).

- [ ] **Step 2: Run to fail** — `npm --workspace @kiwi/client-mobile run test -- orders`.

- [ ] **Step 3: Implementar los módulos** con las rutas exactas de la API (menú público `/menu/merchant/:id[/items]`, `/menu/tomorrow`; guest `/orders/guest` o `/orders` según el controller real — **verificar el endpoint guest exacto** en `api/src/orders/orders.controller.ts` antes de fijar la ruta).

- [ ] **Step 4: Run + type-check + commit** `feat(client-mobile): api modules`.

---

### Task C5: Carrito (lógica pura) + store persistido

**Files:** `apps/client-mobile/src/cart/math.ts`, `apps/client-mobile/src/cart/store.ts`, `apps/client-mobile/src/cart/__tests__/math.test.ts`

**Interfaces:**

- Produces:
  - `unitPriceFor(base, selected)` (suma de opciones), `lineTotal(line)`, `cartSubtotal(lines)` — puros.
  - `createCartStore({ storage })` (Zustand) con `add/remove/setQty/clear`, persistido.

- [ ] **Step 1: Write the failing test**

```ts
import { unitPriceFor, cartSubtotal } from '../math';
test('unitPrice adds option prices to base', () => {
  expect(
    unitPriceFor(4500, [
      { optionId: 'a', price: 300 },
      { optionId: 'b', price: 200 },
    ]),
  ).toBe(5000);
});
test('cartSubtotal multiplies by quantity', () => {
  expect(
    cartSubtotal([
      { unitPrice: 5000, quantity: 2 },
      { unitPrice: 1500, quantity: 1 },
    ]),
  ).toBe(11500);
});
```

```ts
import { createCartStore } from '../store';
test('add merges same lineId and increments quantity', () => {
  const s = createCartStore({ storage: null });
  s.getState().add({
    lineId: 'l1',
    menuItemId: 'i1',
    name: 'Bowl',
    unitPrice: 4500,
    quantity: 1,
    selectedOptions: [],
  });
  s.getState().add({
    lineId: 'l1',
    menuItemId: 'i1',
    name: 'Bowl',
    unitPrice: 4500,
    quantity: 1,
    selectedOptions: [],
  });
  expect(s.getState().lines[0].quantity).toBe(2);
});
```

- [ ] **Step 2: Run to fail** — `-- math`.

- [ ] **Step 3: Implement** `math.ts` (puro) y `store.ts` (Zustand; `storage` opcional para tests).

- [ ] **Step 4: Run + commit** `feat(client-mobile): cart math and persisted store`.

---

### Task C6: Idempotencia por pedido (pura)

**Files:** `apps/client-mobile/src/order/idempotency.ts`, `apps/client-mobile/src/order/__tests__/idempotency.test.ts`

**Interfaces:**

- Produces: `createIdempotencyManager(genKey)` → `{ keyFor(checkoutId): string; reset(checkoutId): void }` — una key estable por `checkoutId` (se genera una vez y se reusa al reintentar el mismo checkout; al completar/cancelar se `reset`).

- [ ] **Step 1: Write the failing test**

```ts
import { createIdempotencyManager } from '../idempotency';
let n = 0;
test('key is stable for the same checkout and changes after reset', () => {
  const m = createIdempotencyManager(() => `k${++n}`);
  const a = m.keyFor('c1');
  const b = m.keyFor('c1');
  expect(a).toBe(b); // reintento: misma key
  m.reset('c1');
  expect(m.keyFor('c1')).not.toBe(a); // pedido nuevo: key nueva
});
test('different checkouts get different keys', () => {
  const m = createIdempotencyManager(() => `k${++n}`);
  expect(m.keyFor('c2')).not.toBe(m.keyFor('c3'));
});
```

- [ ] **Step 2: Run to fail** — `-- idempotency`.

- [ ] **Step 3: Implement**

```ts
export function createIdempotencyManager(genKey: () => string) {
  const keys = new Map<string, string>();
  return {
    keyFor(checkoutId: string): string {
      let k = keys.get(checkoutId);
      if (!k) {
        k = genKey();
        keys.set(checkoutId, k);
      }
      return k;
    },
    reset(checkoutId: string) {
      keys.delete(checkoutId);
    },
  };
}
```

- [ ] **Step 4: Run + commit** `feat(client-mobile): per-order idempotency manager`.

---

### Task C7: Cola offline de creación de pedido + sync

**Files:** `apps/client-mobile/src/order/queue.ts`, `apps/client-mobile/src/order/__tests__/queue.test.ts`

**Interfaces:**

- Consumes: `@kiwi/mobile-core` (engine, drainQueue, sqlite store helper).
- Produces: `createOrderQueue(engine, ordersApi)` → `{ submit(checkoutId, body, authed): Promise<{queued:boolean; order?:any}>; flush(): Promise<number> }` — online intenta crear; sin red o 5xx encola; 4xx (no permanente por red) reporta.

- [ ] **Step 1: Write the failing test**

```ts
import { createMemoryStore, createQueueEngine } from '@kiwi/mobile-core';
import { createOrderQueue } from '../queue';
const engine = () => createQueueEngine(createMemoryStore(), () => Date.now());
test('online creates immediately', async () => {
  const api = { createAuthed: jest.fn(async () => ({ id: 'o1' })), createGuest: jest.fn() } as any;
  const q = createOrderQueue(engine(), api);
  const r = await q.submit('c1', { merchantId: 'm1' }, true);
  expect(r).toMatchObject({ queued: false, order: { id: 'o1' } });
});
test('offline queues the order', async () => {
  const api = {
    createAuthed: jest.fn(async () => {
      throw new TypeError('Network request failed');
    }),
    createGuest: jest.fn(),
  } as any;
  const e = engine();
  const q = createOrderQueue(e, api);
  const r = await q.submit('c1', { merchantId: 'm1' }, true);
  expect(r).toMatchObject({ queued: true });
  expect(await e.size()).toBe(1);
});
```

> Nota: `submit` encola como operación `create` con `payload = { checkoutId, body, authed, idempotencyKey }`. Extender `OpKind` en `mobile-core` con `'create'` (aditivo) o modelar `create` como `kind: 'accept'`? **No** — agregar `'create'` a `OpKind` y manejar en `drainQueue` con un `ordersApi.createAuthed/createGuest` inyectado.

- [ ] **Step 2: Run to fail** — `-- queue`.

- [ ] **Step 3: Implement** `queue.ts` (+ pequeño ajuste aditivo en `mobile-core` para `OpKind: 'create'` y su rama en `drainQueue`, con test).

- [ ] **Step 4: Run + type-check + commit** `feat(client-mobile): offline order queue`.

---

### Task C8: Pagos hosted (parser de retorno puro + checkout adaptador)

**Files:** `apps/client-mobile/src/payments/returnLink.ts`, `apps/client-mobile/src/payments/checkout.ts`, `apps/client-mobile/src/payments/__tests__/returnLink.test.ts`

**Interfaces:**

- Produces:
  - `parseReturnUrl(url, scheme)` → `{ status: 'success'|'cancel'|'unknown'; orderId?: string }` (puro).
  - `startHostedCheckout({ checkoutUrl, scheme, openAuthSession, api, orderId, pollMs })` abre `expo-web-browser` y hace **polling** de `api.status(orderId)` hasta terminal o timeout.

- [ ] **Step 1: Write the failing test**

```ts
import { parseReturnUrl } from '../returnLink';
test('detects success and orderId', () => {
  expect(
    parseReturnUrl('kiwicliente://payment/return?status=success&orderId=o1', 'kiwicliente'),
  ).toEqual({ status: 'success', orderId: 'o1' });
});
test('detects cancel', () => {
  expect(parseReturnUrl('kiwicliente://payment/return?status=cancel', 'kiwicliente').status).toBe(
    'cancel',
  );
});
test('unknown on foreign url', () => {
  expect(parseReturnUrl('https://x/y', 'kiwicliente').status).toBe('unknown');
});
```

- [ ] **Step 2: Run to fail** — `-- returnLink`.

- [ ] **Step 3: Implement** `returnLink.ts` (puro) y `checkout.ts` (usa `WebBrowser.openAuthSessionAsync` y el api de pagos/estado; polling con backoff simple).

- [ ] **Step 4: Run + commit** `feat(client-mobile): hosted checkout return parsing and polling`.

---

### Task C9: Tracking — ETA puro + mapa MapLibre

**Files:** `apps/client-mobile/src/tracking/eta.ts`, `apps/client-mobile/components/TrackingMap.tsx`, `apps/client-mobile/src/tracking/__tests__/eta.test.ts`

**Interfaces:**

- Produces: `computeEta({ driver?, pickup, delivery, serverEtaMin? })` → `{ minutes: number|null; source: 'server'|'estimate'|'none' }` (puro); `TrackingMap({ pickup, delivery, driver? })` con `@maplibre/maplibre-react-native`.

- [ ] **Step 1: Write the failing test**

```ts
import { computeEta } from '../eta';
test('prefers server eta when present', () => {
  expect(computeEta({ serverEtaMin: 12 } as any)).toEqual({ minutes: 12, source: 'server' });
});
test('none without data', () => {
  expect(computeEta({} as any)).toEqual({ minutes: null, source: 'none' });
});
```

- [ ] **Step 2: Run to fail** — `-- eta`.

- [ ] **Step 3: Implement** `eta.ts` (puro) y `TrackingMap.tsx` (instala `@maplibre/maplibre-react-native`; si el setup nativo es pesado, envolver en un componente y documentar el paso nativo; el ETA puro se testea igual).

- [ ] **Step 4: Run + type-check + commit** `feat(client-mobile): tracking eta and MapLibre map`.

---

### Task C10: Sesión (guest-friendly) + pantallas (discover/QR/menú/carrito/checkout/tracking/rate/profile)

**Files:** `apps/client-mobile/src/session/store.ts`, `src/session/useSession.ts`, y las pantallas listadas en File Structure.

**Interfaces:**

- Consumes: `menuApi`, `ordersApi`, `paymentsApi`, `geocodingApi`, cart store, idempotency, order queue, checkout, TrackingMap.

- [ ] **Step 1: Session store test**

```ts
import { createSessionStore } from '../session/store';
test('guest has no token; signIn stores tokens', async () => {
  const storage = {
    getAccess: async () => null,
    setTokens: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  } as any;
  const api = {
    login: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } })),
  } as any;
  const s = createSessionStore({ storage, api });
  expect(s.getState().user).toBeNull();
  await s.getState().signIn('maria@test.com', '123456');
  expect(storage.setTokens).toHaveBeenCalled();
});
```

- [ ] **Step 2: Screens** — implementar con NativeWind + `mobile-ui` + Query:
  - `comercios.tsx` (discover), `scan.tsx` (expo-camera barcode → routing a `/menu/[id]`),
  - `menu/[id].tsx` (categorías, items, variantes/opciones via picker, preventa, agregar al carrito con `QtyStepper`),
  - `checkout.tsx` (pickup/envío, geocoding, programado, método de pago → efectivo directo / hosted / crypto),
  - `tracking/[id].tsx` (socket/polling + `TrackingMap` + ETA), `rate/[id].tsx`,
  - `orders.tsx`, `profile.tsx`, `login.tsx`, `register.tsx`.

- [ ] **Step 3: type-check** `npm --workspace @kiwi/client-mobile run type-check` → 0.

- [ ] **Step 4: Commit** `feat(client-mobile): session and screens`.

---

### Task C11: Push + EAS + README + CI

**Files:** `apps/client-mobile/src/notifications/register.ts`, `eas.json`, `README.md`, CI workflow.

- [ ] **Step 1:** `registerPush` reusando el patrón de driver (`getDevicePushTokenAsync` → `PUT /notifications/device-token`). Test del payload (puro).
- [ ] **Step 2:** `eas.json` igual que driver; `README.md` (requisitos, APNs, `EXPO_PUBLIC_API_URL`, dev client iOS/Android, nota de dispositivo real).
- [ ] **Step 3:** Job CI `mobile` extendido para incluir `@kiwi/client-mobile` (type-check + test) y `@kiwi/mobile-core`.
- [ ] **Step 4: verify** type-check + tests de client-mobile; **commit** `chore(client-mobile): push, EAS, README and CI`.

---

## Self-Review

**1. Spec coverage**

- CL-01 QR → C10 (`scan.tsx`); CL-02 menú → C10; CL-03 carrito → C5/C10; CL-04 pickup/envío → C10;
  CL-05 pagos → C8/C10; CL-06 programado → C10; CL-07 tracking+mapa → C9/C10; CL-08 historial+rating → C10.
- Follows → C4/C10. Guest-first → C10/C4. Offline-first → C7/C8. Push → C11. Reuso `mobile-ui` → C2. DRY (core) → C1.

**2. Placeholder scan:** sin TBD; cada paso con código/comando real. Los pasos C4 (endpoint guest exacto) y C7 (`OpKind:'create'`) dicen explícitamente QUÉ verificar/agregar.

**3. Type consistency:** `createHttp`/`HttpError` (C1) usados en C4; `createQueueEngine`/`drainQueue` (C1) en C7; `ordersApi` (C4) en C7/C10; `parseReturnUrl` (C8) en C10; `computeEta`/`createIdempotencyManager` (C6/C9) en C10; `QtyStepper` (C2) en C10.

**Nota:** C1 toca `driver-mobile` (mecánico, para no duplicar). Si se prefiere cero cambios en driver, alternativa: duplicar los módulos en client-mobile y postergar la extracción — no recomendado (DRY).
