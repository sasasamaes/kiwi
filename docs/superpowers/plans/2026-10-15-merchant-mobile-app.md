# Kiwi Negocios — App móvil nativa (Expo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la app nativa iOS+Android de Kiwi Negocios (Expo + TS + NativeWind): recepción de pedidos en vivo con alertas confiables (KDS + push), comandas, avance de estados con foto de retiro, y solicitar/elegir repartidor.

**Architecture:** `apps/merchant-mobile` (Expo Router) consume `packages/mobile-ui` (tema/componentes) y `packages/mobile-core` (http, realtime). La lógica de comandas (estado→columna, ordenamiento, reducer de eventos) es pura y testeable en Node; los adaptadores (socket, push, keep-awake, cámara) son finos.

**Tech Stack:** Expo SDK 57 · Expo Router · TypeScript strict · NativeWind v4 · TanStack Query · Zustand · expo-secure-store · expo-notifications · expo-image-picker · expo-keep-awake · socket.io-client · jest + jest-expo + RNTL · EAS.

## Global Constraints

- Node **>= 20**; **Expo SDK 57** (igual que `mobile-ui`/`mobile-core`/`driver-mobile`/`client-mobile`).
- Plataformas: **iOS + Android desde el día 0**.
- Estilos: **NativeWind**; tokens de `packages/mobile-ui`.
- Reutilización: `packages/mobile-ui`, `packages/mobile-core`, `@kiwi/types`, `@kiwi/i18n`. **NO** `packages/ui` (web).
- HTTP vía `src/api` sobre `mobile-core`; token en **expo-secure-store**; refresh en 401.
- Lógica testeable en Node sin módulos nativos (interfaces inyectadas).
- **Sin secretos**. Commits **conventional**, sin atribución a IA.

---

## File Structure

```
apps/merchant-mobile/
  app.json eas.json package.json babel/metro/tailwind/global.css/tsconfig/jest
  app/_layout.tsx app/index.tsx
  app/(auth)/login.tsx
  app/(app)/_layout.tsx           # guard + socket + push + KDS keep-awake + netinfo
  app/(app)/comandas.tsx          # KDS board
  app/(app)/order/[id].tsx        # detalle: estados + foto de retiro + asignar repartidor
  app/(app)/drivers.tsx           # solicitar/elegir repartidor (disponibles/favoritos/propuestas)
  app/(app)/notifications.tsx
  app/(app)/profile.tsx
  src/api/storage.ts src/api/http.ts src/api/client.ts
  src/api/auth.ts src/api/orders.ts src/api/drivers.ts src/api/proposals.ts src/api/notifications.ts
  src/comanda/board.ts            # PURO: estado→columna, orden, reducer de eventos
  src/session/store.ts src/session/useSession.ts
  src/realtime/useOrdersRealtime.ts   # envuelve mobile-core createRealtime
  src/notifications/register.ts src/notifications/useNativeToken.ts
  src/kds/useKeepAwake.ts
  README.md
```

---

### Task M1: Scaffold `apps/merchant-mobile`

**Files:** `apps/merchant-mobile/**` (mirror de `apps/driver-mobile`)

**Interfaces:** Consumes `@kiwi/mobile-ui`, `@kiwi/mobile-core`.

- [ ] **Step 1: Scaffold** (desde `apps/`)

```bash
npx create-expo-app@latest merchant-mobile --template blank-typescript --no-install
```

Wire Expo Router + NativeWind (v4.2.7 + tailwind 3.4) copiando configs de `apps/driver-mobile`. `app.json`: name "Kiwi Negocios", slug `kiwi-negocios`, scheme `kwinegocios`, portrait, dark, plugins `["expo-router","expo-secure-store",["expo-image-picker",{"cameraPermission":"Kiwi usa la cámara para la foto de retiro.","photosPermission":"Kiwi accede a tus fotos para la evidencia de retiro."}],["expo-notifications",{"color":"#22c55e"}]]`, android package `express.kiwicr.negocios`, ios supportsTablet true.

- [ ] **Step 2: deps** (root install): `@kiwi/mobile-ui`, `@kiwi/mobile-core`, `@kiwi/types`, `@kiwi/i18n`; devDeps jest, jest-expo@~57.0.6, @types/jest, @testing-library/react-native@^13.3.3, react-test-renderer@19.2.3.

- [ ] **Step 3: placeholder** `app/index.tsx` → `<Screen><Text style={{color:tokens.color.ink}}>Kiwi Negocios</Text></Screen>`; `app/_layout.tsx` con QueryClientProvider + SafeAreaProvider + Stack.

- [ ] **Step 4: verify** `npm --workspace @kiwi/merchant-mobile run type-check` (0) + `npx expo config --type public --json` OK.

- [ ] **Step 5: commit** `chore(merchant-mobile): scaffold Expo Router app with NativeWind and shared UI`

---

### Task M2: API client + módulos de dominio

**Files:** `src/api/{storage,http,client,auth,orders,drivers,proposals,notifications}.ts`, `src/api/__tests__/orders.test.ts`

**Interfaces:**

- `authApi(http)`: `login(email,password)`, `profile()`, `refresh(token)`
- `ordersApi(http)`: `incoming(status?)` `GET /orders/incoming`, `mine()` `GET /orders/my`, `get(id)`, `updateStatus(id, status)` `PUT /orders/:id/status`, `uploadPickupProof(id, form)` `POST /orders/:id/proof-photo` (kind=pickup), `assign(orderId, driverProfileId)` `PUT /orders/:id/assign`
- `driversApi(http)`: `available()` , `favorites()` (verificar rutas reales en `api/src/drivers` y `api/src/favorites`/`FavoriteDriver`)
- `proposalsApi(http)`: `list(orderId)` `GET /orders/:id/proposals`, `accept(orderId, proposalId)` `PUT /orders/:orderId/proposals/:proposalId/accept`
- `notificationsApi(http)`: `registerDevice(token, platform)` `PUT /notifications/device-token`

- [ ] **Step 1: failing test**

```ts
import { ordersApi } from '../orders';
const fake = { get: jest.fn(), post: jest.fn(), put: jest.fn(), postMultipart: jest.fn() } as any;
test('updateStatus PUTs /orders/:id/status', async () => {
  await ordersApi(fake).updateStatus('o1', 'picked_up');
  expect(fake.put).toHaveBeenCalledWith('/orders/o1/status', { status: 'picked_up' });
});
test('uploadPickupProof posts multipart', async () => {
  const f = new FormData();
  await ordersApi(fake).uploadPickupProof('o1', f);
  expect(fake.postMultipart).toHaveBeenCalledWith('/orders/o1/proof-photo', f);
});
```

> Verificar en los controllers las rutas exactas de `incoming`, disponible de drivers y favoritos antes de fijarlas; usar las reales y reportar.

- [ ] **Step 2: run to fail** `npm --workspace @kiwi/merchant-mobile run test -- orders`
- [ ] **Step 3: implement** los módulos (patrón de `client-mobile/src/api`).
- [ ] **Step 4: run + type-check + commit** `feat(merchant-mobile): api modules`

---

### Task M3: Modelo de comandas (PURO)

**Files:** `src/comanda/board.ts`, `src/comanda/__tests__/board.test.ts`

**Interfaces:**

- `columnFor(status): 'new'|'preparing'|'ready'|'closed'`
- `sortByOldest(orders): Order[]` (por `createdAt` asc)
- `applyEvent(state, event): Order[]` — reducer puro para `order:create|order:statusUpdate|order:taken` (dedupe por id; update por id).

- [ ] **Step 1: failing test**

```ts
import { columnFor, sortByOldest, applyEvent } from '../board';
test('maps statuses to KDS columns', () => {
  expect(columnFor('pending')).toBe('new');
  expect(columnFor('assigned')).toBe('preparing');
  expect(columnFor('picked_up')).toBe('ready');
  expect(columnFor('delivered')).toBe('closed');
  expect(columnFor('cancelled')).toBe('closed');
});
test('sorts oldest first', () => {
  const out = sortByOldest([
    { id: 'b', createdAt: 2 },
    { id: 'a', createdAt: 1 },
  ] as any);
  expect(out.map((o) => o.id)).toEqual(['a', 'b']);
});
test('applyEvent inserts new and updates existing', () => {
  let s: any[] = [];
  s = applyEvent(s, { type: 'create', order: { id: 'o1', status: 'pending' } });
  s = applyEvent(s, { type: 'status', order: { id: 'o1', status: 'assigned' } });
  expect(s).toHaveLength(1);
  expect(s[0].status).toBe('assigned');
});
```

- [ ] **Step 2: run to fail** `-- board`
- [ ] **Step 3: implement**

```ts
export type Column = 'new' | 'preparing' | 'ready' | 'closed';
export function columnFor(status: string): Column {
  if (status === 'pending' || status === 'no_driver') return 'new';
  if (status === 'assigned' || status === 'in_transit_to_pickup') return 'preparing';
  if (status === 'picked_up' || status === 'in_transit_to_delivery') return 'ready';
  return 'closed'; // delivered/cancelled
}
export function sortByOldest<T extends { createdAt: number | string }>(orders: T[]): T[] {
  return [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
export type BoardEvent = {
  type: 'create' | 'status' | 'taken';
  order: { id: string; status: string };
};
export function applyEvent<T extends { id: string }>(state: T[], e: BoardEvent): T[] {
  const exists = state.some((o) => o.id === e.order.id);
  if (e.type === 'create' && !exists) return [...state, e.order as any];
  if (e.type === 'taken' && !exists) return state;
  return state.map((o) => (o.id === e.order.id ? { ...o, ...e.order } : o));
}
```

- [ ] **Step 4: run + commit** `feat(merchant-mobile): pure KDS comanda board model`

---

### Task M4: Sesión (Zustand) + Login

**Files:** `src/session/store.ts`, `src/session/useSession.ts`, `app/(auth)/login.tsx`, `app/index.tsx`, `src/api/client.ts`, `src/session/__tests__/store.test.ts`

- [ ] **Step 1: failing test** (mismo patrón que driver/client: `signIn` guarda tokens; `hydrate` sin token → user null; `signOut` limpia).
- [ ] **Step 2: run to fail** `-- store`
- [ ] **Step 3: implement** store + `useSession` singleton + login screen (AuthForm-like: email/password; `#auth-email`/`#auth-password` para consistencia) + `app/index.tsx` redirect + `src/api/client.ts` (http singleton con refresh).
- [ ] **Step 4: run + type-check + commit** `feat(merchant-mobile): session store and login`

---

### Task M5: Realtime + alertas (socket, push, sonido, KDS keep-awake)

**Files:** `src/realtime/useOrdersRealtime.ts`, `src/notifications/register.ts`, `src/notifications/useNativeToken.ts`, `src/kds/useKeepAwake.ts`, `app/(app)/_layout.tsx`

**Interfaces:**

- `useOrdersRealtime({ onEvent })` — envuelve `createRealtime` de `mobile-core` (getToken desde secureStorage; handlers `onNewOrder`/`onStatusChanged`/`onOrderTaken` → `onEvent({type, order})`).
- `registerPush(notificationsApi, getDevicePushToken, os)` (patrón driver) + test puro.
- `useKeepAwake(active: boolean)` — `expo-keep-awake` activate/deactivate.

- [ ] **Step 1: failing test** `src/notifications/__tests__/register.test.ts` (payload/platform/registerPush, igual que driver).
- [ ] **Step 2: run to fail** `-- register`
- [ ] **Step 3: implement** register + useNativeToken + useKeepAwake + useOrdersRealtime; en `(app)/_layout.tsx`: guard de sesión, **conectar socket**, **registrar push** (una vez, ref), **keep-awake mientras la tab de comandas esté activa**, flush por reconexión (netinfo reusa el patrón).
- [ ] **Step 4: run + type-check + commit** `feat(merchant-mobile): realtime, push and KDS keep-awake`

---

### Task M6: Tablero de comandas (KDS) + detalle con estados y foto de retiro

**Files:** `app/(app)/comandas.tsx`, `app/(app)/order/[id].tsx`

- [ ] **Step 1: comandas.tsx** — tablero con columnas (`new`/`preparing`/`ready`) usando `columnFor`/`sortByOldest`; suscribe `useOrdersRealtime` → `applyEvent`; tarjeta por comanda (ítems, notas/variantes, tipo, dirección, tiempo); suena al crear (usa un helper de sonido local); `RefreshControl`/query de respaldo (`ordersApi.incoming()`).
- [ ] **Step 2: order/[id].tsx** — detalle + acciones: avanzar estado (`updateStatus`), **subir foto de retiro** (`ImagePicker` → `uploadPickupProof`), ver repartidor asignado/propuestas; link a solicitar/elegir repartidor.
- [ ] **Step 3: type-check + commit** `feat(merchant-mobile): KDS board and order detail with pickup photo`

---

### Task M7: Solicitar y elegir repartidor

**Files:** `app/(app)/drivers.tsx`

- [ ] **Step 1:** lista de **disponibles** y **favoritos** (`driversApi.available/favorites`); acción **solicitar** (broadcast). Para programados: listar **propuestas** (`proposalsApi.list`) con nivel/rating/vehículo y **aceptar** (`accept`) → `assign`.
- [ ] **Step 2: type-check + commit** `feat(merchant-mobile): request and pick a driver`

---

### Task M8: Notificaciones + Perfil

**Files:** `app/(app)/notifications.tsx`, `app/(app)/profile.tsx`

- [ ] **Step 1:** centro de notificaciones (derivado de eventos/`notifications` si existe endpoint) + perfil (nombre del negocio, teléfono) + logout.
- [ ] **Step 2: type-check + commit** `feat(merchant-mobile): notifications and profile`

---

### Task M9: EAS + README + CI

**Files:** `apps/merchant-mobile/eas.json`, `apps/merchant-mobile/README.md`, `.github/workflows/ci.yml`

- [ ] **Step 1:** `eas.json` igual que driver/client; README (requisitos, APNs en Firebase, `EXPO_PUBLIC_API_URL`, dev client iOS/Android, KDS en tablet, nota dispositivo real).
- [ ] **Step 2:** extender el job `mobile` de CI para incluir `@kiwi/merchant-mobile` (type-check + test).
- [ ] **Step 3: verify + commit** `chore(merchant-mobile): EAS, README and CI`

---

## Self-Review

**1. Spec coverage**

- ME-04 recepción en vivo → M5/M6; ME-05 estados + foto de retiro → M6; ME-06 solicitar repartidor → M7;
  ME-07 elegir por calidad → M7; ME-10 notificaciones → M8; alertas doble modo → M5/M6 (KDS keep-awake + push);
  perfil/login → M4. Non-goals (menú/analytics/QR/traffic/ads/credits/KYC) → fuera.
- Reuso `mobile-ui`/`mobile-core` → M1/M2/M5. Lógica pura → M3. CI/EAS → M9.

**2. Placeholder scan:** sin TBD; pasos con código/comando. Los endpoints a verificar (drivers disponible/favoritos, incoming, proposals) están marcados explícitamente.

**3. Type consistency:** `columnFor`/`applyEvent`/`sortByOldest` (M3) usados en M6; `ordersApi.updateStatus/uploadPickupProof/assign` (M2) en M6/M7; `registerPush` (M5) en `(app)/_layout`; `createRealtime` (mobile-core) en M5; `useSession` (M4) en layouts.
