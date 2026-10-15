# Kiwi Repartidores — App móvil nativa (Expo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la app nativa iOS+Android de Kiwi Repartidores (Expo + TS + NativeWind) que cubre el núcleo del turno: login, online/offline, pedidos disponibles, aceptar/rechazar, ciclo de estados con foto de entrega, push (FCM existente), ubicación en segundo plano y cola offline-first.

**Architecture:** Monorepo con `packages/mobile-ui` (tema/tokens de `docs/DESIGN.md`, componentes RN, preset NativeWind, reusado por las 3 apps futuras) y `apps/driver-mobile` (Expo Router). La lógica no-UI (cola offline, sync, realtime, clustering de ubicación, payloads de push) se escribe **pura y con dependencias inyectadas** para poder testearla en Node/Jest sin módulos nativos; los adaptadores (SQLite, SecureStore, socket, expo-location) son finos.

**Tech Stack:** Expo (SDK estable) · Expo Router · TypeScript strict · NativeWind (Tailwind RN) · TanStack Query · Zustand · expo-sqlite · expo-secure-store · expo-notifications · expo-location + expo-task-manager · expo-camera · socket.io-client · jest + jest-expo + @testing-library/react-native · EAS Build.

## Global Constraints

- Node **>= 20**; versiones de Expo/RN las resuelve `npx create-expo-app` (no fijar a mano salvo lo indicado).
- Plataformas: **iOS + Android desde el día 0**.
- Estilos: **NativeWind**; tokens de color/tipografía derivados de `docs/DESIGN.md`.
- Reutilización permitida: **`@kiwi/types`, `@kiwi/i18n`**. **NO** depender de `packages/ui` (es web).
- Toda llamada HTTP pasa por `apps/driver-mobile/src/api`; el token vive en **expo-secure-store**.
- Lógica testeable en Node: cola, sync, realtime, push payload, clustering de ubicación **no** importan módulos nativos (usan interfaces inyectadas).
- **Sin secretos** en el repo. Commits **conventional** (`feat|fix|test|chore|docs`), sin atribución a IA.
- Comandos desde la raíz del repo salvo que se indique; usar npm workspaces.
- JWT: access + refresh; al 401 → refresh silencioso; si falla, logout.

---

## File Structure

```
packages/mobile-ui/
  package.json
  tsconfig.json
  tailwind-preset.js            # preset NativeWind con los tokens
  nativewind-env.d.ts
  jest.config.js
  src/theme/tokens.ts           # fuente de verdad de colores/spacing/radius (TS)
  src/theme/index.ts
  src/components/Screen.tsx     # wrapper de pantalla (safe area, fondo)
  src/components/Button.tsx
  src/components/StatusBadge.tsx
  src/index.ts
  src/__tests__/theme.test.ts
  src/__tests__/Button.test.tsx

apps/driver-mobile/
  app.json
  eas.json
  package.json
  babel.config.js
  metro.config.js
  tailwind.config.js
  global.css
  tsconfig.json
  jest.config.js
  jest.setup.ts
  app/_layout.tsx
  app/index.tsx                 # redirección según sesión
  app/(auth)/login.tsx
  app/(app)/_layout.tsx         # guard de sesión + tab/stack
  app/(app)/index.tsx           # Home: toggle online/offline + Disponibles
  app/(app)/order/[id].tsx      # Pedido activo: estados + foto de entrega
  app/(app)/profile.tsx         # Perfil mínimo + logout
  src/api/http.ts               # fetch + base URL + auth header + refresh (inyectable)
  src/api/storage.ts            # interface TokenStorage + adaptador SecureStore
  src/api/auth.ts
  src/api/orders.ts
  src/api/notifications.ts
  src/api/__tests__/http.test.ts
  src/session/store.ts          # Zustand: user, token, online, hydrate(), logout()
  src/session/__tests__/store.test.ts
  src/queue/types.ts            # QueueStore interface + tipos de operación
  src/queue/memory-store.ts     # adaptador en memoria (tests)
  src/queue/sqlite-store.ts     # adaptador expo-sqlite (runtime)
  src/queue/engine.ts           # FIFO + idempotencia + conflicto (PURO)
  src/queue/__tests__/engine.test.ts
  src/queue/sync.ts             # orquestador: drena la cola contra la API (inyectable)
  src/queue/__tests__/sync.test.ts
  src/realtime/socket.ts        # wrapper socket.io-client (factory inyectable)
  src/realtime/__tests__/socket.test.ts
  src/location/batch.ts         # clustering/throttle de ubicación (PURO)
  src/location/task.ts          # expo-location + task-manager (adaptador)
  src/location/__tests__/batch.test.ts
  src/notifications/register.ts # buildTokenPayload + register()
  src/notifications/__tests__/register.test.ts
  src/order/transitions.ts      # máquina de estados válidos (PURO)
  src/order/__tests__/transitions.test.ts
  README.md
```

---

### Task 1: `packages/mobile-ui` — tokens, preset NativeWind y componentes base

**Files:**

- Create: `packages/mobile-ui/package.json`
- Create: `packages/mobile-ui/tsconfig.json`
- Create: `packages/mobile-ui/tailwind-preset.js`
- Create: `packages/mobile-ui/src/theme/tokens.ts`
- Create: `packages/mobile-ui/src/theme/index.ts`
- Create: `packages/mobile-ui/src/components/Screen.tsx`
- Create: `packages/mobile-ui/src/components/Button.tsx`
- Create: `packages/mobile-ui/src/components/StatusBadge.tsx`
- Create: `packages/mobile-ui/src/index.ts`
- Create: `packages/mobile-ui/jest.config.js`
- Test: `packages/mobile-ui/src/__tests__/theme.test.ts`
- Test: `packages/mobile-ui/src/__tests__/Button.test.tsx`

**Interfaces:**

- Produces: `tokens` (colores `canvas/surface/border/ink/muted/kiwi/lime/emerald/amber/sinpe/danger`, `radius`, `space`); `Screen({children})`, `Button({label,onPress,variant?,loading?,disabled?})`, `StatusBadge({status})`; preset NativeWind en `tailwind-preset.js`.

- [ ] **Step 1: package.json**

```json
{
  "name": "@kiwi/mobile-ui",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit",
    "test": "jest",
    "lint": "eslint src"
  },
  "peerDependencies": { "react": ">=18", "react-native": ">=0.74" },
  "devDependencies": {
    "@testing-library/react-native": "^12.0.0",
    "@types/react": "^19.0.0",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "react": "19.0.0",
    "react-native": "0.76.0",
    "react-test-renderer": "19.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "jsx": "react-jsx", "noEmit": true, "lib": ["ES2022"] },
  "include": ["src", "nativewind-env.d.ts"]
}
```

- [ ] **Step 3: Write the failing test (tokens)**

```ts
// packages/mobile-ui/src/__tests__/theme.test.ts
import { tokens } from '../theme';

test('exposes the DESIGN.md brand colors', () => {
  expect(tokens.color.kiwi).toBe('#22c55e');
  expect(tokens.color.canvas).toBe('#0b1326');
  expect(tokens.color.amber).toBe('#f59e0b');
});

test('has a positive spacing scale', () => {
  expect(tokens.space[4]).toBe(16);
  expect(tokens.space[6]).toBe(24);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm --workspace @kiwi/mobile-ui run test -- theme`
Expected: FAIL ("Cannot find module '../theme'").

- [ ] **Step 5: tokens.ts + theme index**

```ts
// packages/mobile-ui/src/theme/tokens.ts
export const tokens = {
  color: {
    canvas: '#0b1326',
    surface: 'rgba(30,41,59,0.75)',
    border: 'rgba(51,65,85,0.6)',
    ink: '#f8fafc',
    muted: '#94a3b8',
    kiwi: '#22c55e',
    lime: '#4ade80',
    emerald: '#10b981',
    amber: '#f59e0b',
    sinpe: '#0284c7',
    danger: '#ffb4ab',
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 24 },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
} as const;
export type Tokens = typeof tokens;
```

```ts
// packages/mobile-ui/src/theme/index.ts
export { tokens } from './tokens';
export type { Tokens } from './tokens';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm --workspace @kiwi/mobile-ui run test -- theme`
Expected: PASS.

- [ ] **Step 7: Write the failing test (Button)**

```tsx
// packages/mobile-ui/src/__tests__/Button.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../components/Button';

test('calls onPress when pressed', () => {
  const onPress = jest.fn();
  const { getByText } = render(<Button label="Aceptar" onPress={onPress} />);
  fireEvent.press(getByText('Aceptar'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('does not fire while loading', () => {
  const onPress = jest.fn();
  const { getByText } = render(<Button label="Aceptar" onPress={onPress} loading />);
  fireEvent.press(getByText('Aceptar'));
  expect(onPress).not.toHaveBeenCalled();
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm --workspace @kiwi/mobile-ui run test -- Button`
Expected: FAIL ("Cannot find module '../components/Button'").

- [ ] **Step 9: Components + preset + barrel**

```tsx
// packages/mobile-ui/src/components/Button.tsx
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { tokens } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';
export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { label, onPress, variant = 'primary', loading = false, disabled = false } = props;
  const bg =
    variant === 'primary'
      ? tokens.color.kiwi
      : variant === 'danger'
        ? tokens.color.danger
        : tokens.color.surface;
  const fg = variant === 'secondary' ? tokens.color.ink : '#04140a';
  const blocked = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (!blocked) onPress();
      }}
      style={{
        backgroundColor: bg,
        borderRadius: tokens.radius.lg,
        paddingVertical: 14,
        opacity: blocked ? 0.5 : 1,
        alignItems: 'center',
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '700' }}>{label}</Text>
      )}
    </Pressable>
  );
}
```

```tsx
// packages/mobile-ui/src/components/Screen.tsx
import { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.color.canvas }}>
      <View style={{ flex: 1, padding: tokens.space[4] }}>{children}</View>
    </SafeAreaView>
  );
}
```

```tsx
// packages/mobile-ui/src/components/StatusBadge.tsx
import { Text, View } from 'react-native';
import { tokens } from '../theme';

const LABELS: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  in_transit_to_pickup: 'En camino a retiro',
  picked_up: 'Retirado',
  in_transit_to_delivery: 'En camino a entrega',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  no_driver: 'Sin repartidor',
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.sm,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: tokens.color.lime, fontSize: 12, fontWeight: '600' }}>
        {LABELS[status] ?? status}
      </Text>
    </View>
  );
}
```

```js
// packages/mobile-ui/tailwind-preset.js
const { tokens } = require('./src/theme/tokens');
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: tokens.color.canvas,
        surface: tokens.color.surface,
        line: tokens.color.border,
        ink: tokens.color.ink,
        muted: tokens.color.muted,
        kiwi: tokens.color.kiwi,
        lime: tokens.color.lime,
        emerald: tokens.color.emerald,
        amber: tokens.color.amber,
        sinpe: tokens.color.sinpe,
        danger: tokens.color.danger,
      },
    },
  },
};
```

```ts
// packages/mobile-ui/src/index.ts
export { tokens } from './theme';
export { Screen } from './components/Screen';
export { Button } from './components/Button';
export { StatusBadge } from './components/StatusBadge';
```

```js
// packages/mobile-ui/jest.config.js
module.exports = { preset: 'jest-expo', testMatch: ['**/__tests__/**/*.test.(ts|tsx)'] };
```

- [ ] **Step 10: Run tests + type-check**

Run: `npm --workspace @kiwi/mobile-ui run test && npm --workspace @kiwi/mobile-ui run type-check`
Expected: PASS (2 suites) + tsc exit 0.

- [ ] **Step 11: Commit**

```bash
git add packages/mobile-ui
git commit -m "feat(mobile-ui): shared theme tokens, nativewind preset and base components"
```

---

### Task 2: Scaffold `apps/driver-mobile` (Expo Router + NativeWind), arranque vacío

**Files:**

- Create: `apps/driver-mobile/**` (scaffold) — se ajustan `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `app/_layout.tsx`, `app/index.tsx`

**Interfaces:**

- Consumes: `@kiwi/mobile-ui` (tokens/Screen).
- Produces: app Expo que arranca en un `<Screen>` placeholder; `npx expo install --check` limpio; `tsc` limpio.

- [ ] **Step 1: Scaffold**

Run (desde `apps/`):

```bash
npx create-expo-app@latest driver-mobile --template blank-typescript
```

Luego, desde `apps/driver-mobile`:

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install nativewind tailwindcss@^3.4.0
```

- [ ] **Step 2: package.json scripts + entrada**

Editar `apps/driver-mobile/package.json` para agregar (y `"main": "expo-router/entry"`):

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "type-check": "tsc --noEmit",
  "test": "jest",
  "lint": "eslint ."
},
"dependencies": { "@kiwi/mobile-ui": "*", "@kiwi/types": "*", "@kiwi/i18n": "*" }
```

- [ ] **Step 3: NativeWind config**

`apps/driver-mobile/tailwind.config.js`:

```js
const preset = require('../../packages/mobile-ui/tailwind-preset');
module.exports = { presets: [preset], content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'] };
```

`apps/driver-mobile/global.css`: `@tailwind base; @tailwind components; @tailwind utilities;`
`apps/driver-mobile/babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
```

`apps/driver-mobile/metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 4: app.json + tsconfig**

`app.json` (mínimo relevante):

```json
{
  "expo": {
    "name": "Kiwi Repartidores",
    "slug": "kiwi-repartidores",
    "scheme": "kiwirepartidor",
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "plugins": ["expo-router"],
    "ios": { "supportsTablet": false },
    "android": { "package": "express.kiwicr.repartidor" }
  }
}
```

`tsconfig.json`: extender el base con `"compilerOptions": { "strict": true, "jsx": "react-jsx" }` e `"include": ["app", "src", "nativewind-env.d.ts"]`.

- [ ] **Step 5: Placeholder screen**

```tsx
// apps/driver-mobile/app/_layout.tsx
import '../global.css';
import { Stack } from 'expo-router';
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

```tsx
// apps/driver-mobile/app/index.tsx
import { Text } from 'react-native';
import { Screen, tokens } from '@kiwi/mobile-ui';
export default function Index() {
  return (
    <Screen>
      <Text style={{ color: tokens.color.ink }}>Kiwi Repartidores</Text>
    </Screen>
  );
}
```

- [ ] **Step 6: Verify boot + type-check**

Run: `npm --workspace @kiwi/driver-mobile run type-check`
Expected: exit 0.
Run: `npm --workspace @kiwi/driver-mobile run start` (manual, cancel after bundling)
Expected: Metro arranca y compila sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/driver-mobile
git commit -m "chore(driver-mobile): scaffold Expo Router app with NativeWind and shared UI"
```

---

### Task 3: Cliente HTTP con SecureStore + refresh (inyectable)

**Files:**

- Create: `apps/driver-mobile/src/api/storage.ts`
- Create: `apps/driver-mobile/src/api/http.ts`
- Test: `apps/driver-mobile/src/api/__tests__/http.test.ts`
- Create: `apps/driver-mobile/jest.config.js`, `apps/driver-mobile/jest.setup.ts`

**Interfaces:**

- Produces:
  - `interface TokenStorage { getRefresh(): Promise<string|null>; getAccess(): Promise<string|null>; setTokens(a: {access:string; refresh?:string}): Promise<void>; clear(): Promise<void>; }`
  - `createHttp({ baseUrl, getAccessToken, refresh, fetchImpl })` → `{ get<T>(p), post<T>(p,body?), put<T>(p,body?), postMultipart<T>(p, form): Promise<T> }`
  - `consumeSse`/errores: lanza `HttpError { status, body }`.

- [ ] **Step 1: jest config + setup**

```js
// apps/driver-mobile/jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
};
```

```ts
// apps/driver-mobile/jest.setup.ts
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
```

- [ ] **Step 2: Write the failing test**

```ts
// apps/driver-mobile/src/api/__tests__/http.test.ts
import { createHttp, HttpError } from '../http';

const json = (status: number, body: any) => ({
  ok: status < 400,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

test('adds the bearer token to requests', async () => {
  const calls: any[] = [];
  const fetchImpl = async (url: string, init: any) => {
    calls.push({ url, init });
    return json(200, { ok: true });
  };
  const http = createHttp({
    baseUrl: 'http://api.test/api',
    getAccessToken: async () => 'tok',
    refresh: async () => null,
    fetchImpl: fetchImpl as any,
  });
  await http.get('/orders/available');
  expect(calls[0].url).toBe('http://api.test/api/orders/available');
  expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
});

test('on 401 refreshes once and retries', async () => {
  let n = 0;
  let access = 'old';
  const fetchImpl = async () => {
    n++;
    if (n === 1) return json(401, {});
    return json(200, { ok: true });
  };
  const refresh = jest.fn(async () => {
    access = 'new';
    return 'new';
  });
  const http = createHttp({
    baseUrl: 'http://api.test/api',
    getAccessToken: async () => access,
    refresh,
    fetchImpl: fetchImpl as any,
  });
  const out = await http.get('/orders/my');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(out).toEqual({ ok: true });
});

test('throws HttpError with status on 400', async () => {
  const fetchImpl = async () => json(400, { message: 'bad transition' });
  const http = createHttp({
    baseUrl: 'http://api.test/api',
    getAccessToken: async () => 't',
    refresh: async () => null,
    fetchImpl: fetchImpl as any,
  });
  await expect(http.put('/orders/1/status', { status: 'picked_up' })).rejects.toMatchObject({
    status: 400,
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm --workspace @kiwi/driver-mobile run test -- http`
Expected: FAIL ("Cannot find module '../http'").

- [ ] **Step 4: storage.ts**

```ts
// apps/driver-mobile/src/api/storage.ts
import * as SecureStore from 'expo-secure-store';
export interface TokenStorage {
  getAccess(): Promise<string | null>;
  getRefresh(): Promise<string | null>;
  setTokens(t: { access: string; refresh?: string }): Promise<void>;
  clear(): Promise<void>;
}
const A = 'kiwi_access',
  R = 'kiwi_refresh';
export const secureStorage: TokenStorage = {
  getAccess: () => SecureStore.getItemAsync(A),
  getRefresh: () => SecureStore.getItemAsync(R),
  async setTokens({ access, refresh }) {
    await SecureStore.setItemAsync(A, access);
    if (refresh) await SecureStore.setItemAsync(R, refresh);
  },
  async clear() {
    await SecureStore.deleteItemAsync(A);
    await SecureStore.deleteItemAsync(R);
  },
};
```

- [ ] **Step 5: http.ts**

```ts
// apps/driver-mobile/src/api/http.ts
export class HttpError extends Error {
  constructor(
    public status: number,
    public body: any,
  ) {
    super(`HTTP ${status}`);
  }
}
type Deps = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  refresh: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};
export function createHttp(deps: Deps) {
  const f = deps.fetchImpl ?? fetch;
  async function send(method: string, path: string, body?: any, isForm = false) {
    const run = async () => {
      const token = await deps.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
      return f(deps.baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      });
    };
    let res = await run();
    if (res.status === 401) {
      const t = await deps.refresh();
      if (t) res = await run();
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new HttpError(res.status, data);
    return data;
  }
  return {
    get: <T>(p: string) => send('GET', p) as Promise<T>,
    post: <T>(p: string, b?: any) => send('POST', p, b) as Promise<T>,
    put: <T>(p: string, b?: any) => send('PUT', p, b) as Promise<T>,
    postMultipart: <T>(p: string, form: FormData) => send('POST', p, form, true) as Promise<T>,
  };
}
export type Http = ReturnType<typeof createHttp>;
```

- [ ] **Step 6: Run tests + type-check**

Run: `npm --workspace @kiwi/driver-mobile run test -- http && npm --workspace @kiwi/driver-mobile run type-check`
Expected: PASS + tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/driver-mobile/jest.config.js apps/driver-mobile/jest.setup.ts apps/driver-mobile/src/api
git commit -m "feat(driver-mobile): http client with secure token storage and 401 refresh"
```

---

### Task 4: API de dominio (auth, orders, notifications) sobre el http

**Files:**

- Create: `apps/driver-mobile/src/api/auth.ts`
- Create: `apps/driver-mobile/src/api/orders.ts`
- Create: `apps/driver-mobile/src/api/notifications.ts`

**Interfaces:**

- Consumes: `Http` (Task 3), tipos de `@kiwi/types`.
- Produces:
  - `authApi(http): { login(email,password): Promise<{accessToken,refreshToken,user}>; profile(): Promise<User>; refresh(refreshToken): Promise<{accessToken}> }`
  - `ordersApi(http): { available(); mine(); accept(id); reject(id); updateStatus(id, status, extra?); uploadProof(id, uri, kind) }`
  - `notificationsApi(http): { registerDevice(token, platform): Promise<void> }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/driver-mobile/src/api/__tests__/orders.test.ts
import { ordersApi } from '../orders';
const fake = { get: jest.fn(), post: jest.fn(), put: jest.fn(), postMultipart: jest.fn() } as any;
test('accept hits POST /orders/:id/accept', async () => {
  await ordersApi(fake).accept('o1');
  expect(fake.post).toHaveBeenCalledWith('/orders/o1/accept');
});
test('updateStatus hits PUT /orders/:id/status with body', async () => {
  await ordersApi(fake).updateStatus('o1', 'in_transit_to_pickup');
  expect(fake.put).toHaveBeenCalledWith('/orders/o1/status', { status: 'in_transit_to_pickup' });
});
test('uploadProof posts multipart with kind', async () => {
  const form = new FormData();
  await ordersApi(fake).uploadProof('o1', form);
  expect(fake.postMultipart).toHaveBeenCalledWith('/orders/o1/proof-photo', form);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @kiwi/driver-mobile run test -- orders`
Expected: FAIL ("Cannot find module '../orders'").

- [ ] **Step 3: Implement the three modules**

```ts
// apps/driver-mobile/src/api/auth.ts
import type { Http } from './http';
export function authApi(http: Http) {
  return {
    login: (email: string, password: string) => http.post<any>('/auth/login', { email, password }),
    profile: () => http.get<any>('/auth/profile'),
    refresh: (refreshToken: string) => http.post<any>('/auth/refresh', { refreshToken }),
  };
}
```

```ts
// apps/driver-mobile/src/api/orders.ts
import type { Http } from './http';
export type DriverOrderStatus =
  'in_transit_to_pickup' | 'picked_up' | 'in_transit_to_delivery' | 'delivered';
export function ordersApi(http: Http) {
  return {
    available: () => http.get<any[]>('/orders/available'),
    mine: () => http.get<any[]>('/orders/my'),
    accept: (id: string) => http.post<any>(`/orders/${id}/accept`),
    reject: (id: string) => http.post<any>(`/orders/${id}/reject`),
    updateStatus: (id: string, status: DriverOrderStatus) =>
      http.put<any>(`/orders/${id}/status`, { status }),
    uploadProof: (id: string, form: FormData) =>
      http.postMultipart<any>(`/orders/${id}/proof-photo`, form),
  };
}
```

```ts
// apps/driver-mobile/src/api/notifications.ts
import type { Http } from './http';
export function notificationsApi(http: Http) {
  return {
    registerDevice: (token: string, platform: 'ios' | 'android') =>
      http.put<void>('/notifications/device-token', { token, platform }),
  };
}
```

- [ ] **Step 4: Run tests + type-check**

Run: `npm --workspace @kiwi/driver-mobile run test -- orders && npm --workspace @kiwi/driver-mobile run type-check`
Expected: PASS + tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/driver-mobile/src/api
git commit -m "feat(driver-mobile): auth/orders/notifications api modules"
```

---

### Task 5: Máquina de estados del pedido (PURO)

**Files:**

- Create: `apps/driver-mobile/src/order/transitions.ts`
- Test: `apps/driver-mobile/src/order/__tests__/transitions.test.ts`

**Interfaces:**

- Produces: `nextStatus(current): DriverOrderStatus | null`; `canAdvance(current, {pickupProofReady}): { ok: boolean; reason?: 'waiting_pickup_proof' | 'terminal' }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/driver-mobile/src/order/__tests__/transitions.test.ts
import { nextStatus, canAdvance } from '../transitions';
test('linear happy path', () => {
  expect(nextStatus('assigned')).toBe('in_transit_to_pickup');
  expect(nextStatus('in_transit_to_pickup')).toBe('picked_up');
  expect(nextStatus('picked_up')).toBe('in_transit_to_delivery');
  expect(nextStatus('in_transit_to_delivery')).toBe('delivered');
  expect(nextStatus('delivered')).toBeNull();
});
test('picked_up is blocked until the merchant uploaded the pickup proof', () => {
  expect(canAdvance('in_transit_to_pickup', { pickupProofReady: false })).toEqual({
    ok: false,
    reason: 'waiting_pickup_proof',
  });
  expect(canAdvance('in_transit_to_pickup', { pickupProofReady: true })).toEqual({ ok: true });
});
test('terminal statuses cannot advance', () => {
  expect(canAdvance('delivered', { pickupProofReady: true })).toEqual({
    ok: false,
    reason: 'terminal',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @kiwi/driver-mobile run test -- transitions`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/driver-mobile/src/order/transitions.ts
import type { DriverOrderStatus } from '../api/orders';
export type AnyStatus = string;
const NEXT: Record<string, DriverOrderStatus | null> = {
  assigned: 'in_transit_to_pickup',
  in_transit_to_pickup: 'picked_up',
  picked_up: 'in_transit_to_delivery',
  in_transit_to_delivery: 'delivered',
  delivered: null,
};
export function nextStatus(current: AnyStatus): DriverOrderStatus | null {
  return NEXT[current] ?? null;
}
export function canAdvance(
  current: AnyStatus,
  ctx: { pickupProofReady: boolean },
): { ok: true } | { ok: false; reason: 'waiting_pickup_proof' | 'terminal' } {
  const n = nextStatus(current);
  if (!n) return { ok: false, reason: 'terminal' };
  if (current === 'in_transit_to_pickup' && !ctx.pickupProofReady)
    return { ok: false, reason: 'waiting_pickup_proof' };
  return { ok: true };
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npm --workspace @kiwi/driver-mobile run test -- transitions`
Expected: PASS.

```bash
git add apps/driver-mobile/src/order
git commit -m "feat(driver-mobile): pure order status transition machine"
```

---

### Task 6: Motor de cola offline (PURO) + store en memoria

**Files:**

- Create: `apps/driver-mobile/src/queue/types.ts`
- Create: `apps/driver-mobile/src/queue/memory-store.ts`
- Create: `apps/driver-mobile/src/queue/engine.ts`
- Test: `apps/driver-mobile/src/queue/__tests__/engine.test.ts`

**Interfaces:**

- Produces:
  - `type Op = { id: string; kind: 'accept'|'reject'|'status'; orderId: string; payload?: any; createdAt: number; attempts: number };`
  - `interface QueueStore { all(): Promise<Op[]>; add(op: Op): Promise<void>; remove(id: string): Promise<void>; update(op: Op): Promise<void>; }`
  - `createMemoryStore(): QueueStore`
  - `createQueueEngine(store, clock)`: `{ enqueue(kind, orderId, payload?): Promise<Op>; peek(): Promise<Op|null>; complete(id): Promise<void>; fail(id, permanent): Promise<void>; size(): Promise<number> }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/driver-mobile/src/queue/__tests__/engine.test.ts
import { createMemoryStore } from '../memory-store';
import { createQueueEngine } from '../engine';

const clock = () => 1000;
test('FIFO order by createdAt', async () => {
  const e = createQueueEngine(createMemoryStore(), clock);
  await e.enqueue('status', 'o1', { status: 'picked_up' });
  await e.enqueue('accept', 'o2');
  const first = await e.peek();
  expect(first).toMatchObject({ kind: 'status', orderId: 'o1' });
});
test('complete removes the op', async () => {
  const e = createQueueEngine(createMemoryStore(), clock);
  const op = await e.enqueue('accept', 'o1');
  await e.complete(op.id);
  expect(await e.size()).toBe(0);
});
test('permanent failure drops the op; transient keeps it with attempts+1', async () => {
  const e = createQueueEngine(createMemoryStore(), clock);
  const op = await e.enqueue('status', 'o1', { status: 'picked_up' });
  await e.fail(op.id, false);
  expect((await e.peek())!.attempts).toBe(1);
  await e.fail(op.id, true);
  expect(await e.size()).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @kiwi/driver-mobile run test -- engine`
Expected: FAIL.

- [ ] **Step 3: Implement types, memory store, engine**

```ts
// apps/driver-mobile/src/queue/types.ts
export type OpKind = 'accept' | 'reject' | 'status';
export interface Op {
  id: string;
  kind: OpKind;
  orderId: string;
  payload?: any;
  createdAt: number;
  attempts: number;
}
export interface QueueStore {
  all(): Promise<Op[]>;
  add(op: Op): Promise<void>;
  remove(id: string): Promise<void>;
  update(op: Op): Promise<void>;
}
```

```ts
// apps/driver-mobile/src/queue/memory-store.ts
import type { Op, QueueStore } from './types';
export function createMemoryStore(): QueueStore {
  let ops: Op[] = [];
  return {
    all: async () => [...ops],
    add: async (op) => {
      ops.push(op);
    },
    remove: async (id) => {
      ops = ops.filter((o) => o.id !== id);
    },
    update: async (op) => {
      ops = ops.map((o) => (o.id === op.id ? op : o));
    },
  };
}
```

```ts
// apps/driver-mobile/src/queue/engine.ts
import type { Op, OpKind, QueueStore } from './types';
let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;
export function createQueueEngine(store: QueueStore, clock: () => number) {
  const sorted = async () => (await store.all()).sort((a, b) => a.createdAt - b.createdAt);
  return {
    async enqueue(kind: OpKind, orderId: string, payload?: any): Promise<Op> {
      const op: Op = { id: newId(), kind, orderId, payload, createdAt: clock(), attempts: 0 };
      await store.add(op);
      return op;
    },
    async peek(): Promise<Op | null> {
      return (await sorted())[0] ?? null;
    },
    async complete(id: string): Promise<void> {
      await store.remove(id);
    },
    async fail(id: string, permanent: boolean): Promise<void> {
      const op = (await store.all()).find((o) => o.id === id);
      if (!op) return;
      if (permanent) {
        await store.remove(id);
        return;
      }
      await store.update({ ...op, attempts: op.attempts + 1 });
    },
    async size(): Promise<number> {
      return (await store.all()).length;
    },
  };
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npm --workspace @kiwi/driver-mobile run test -- engine`
Expected: PASS.

```bash
git add apps/driver-mobile/src/queue
git commit -m "feat(driver-mobile): pure offline queue engine with FIFO and retry semantics"
```

---

### Task 7: Sync orchestrator (drena la cola contra la API) + store SQLite

**Files:**

- Create: `apps/driver-mobile/src/queue/sync.ts`
- Create: `apps/driver-mobile/src/queue/sqlite-store.ts`
- Test: `apps/driver-mobile/src/queue/__tests__/sync.test.ts`

**Interfaces:**

- Consumes: `createQueueEngine` (Task 6), `ordersApi` (Task 4).
- Produces:
  - `drainQueue(engine, ops, onConflict)`: procesa en orden; `accept/reject/status` vía api; 4xx (excepto 408/429) = permanente (onConflict), 5xx/red = transitorio.
  - `createSqliteStore(db)` → `QueueStore`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/driver-mobile/src/queue/__tests__/sync.test.ts
import { createMemoryStore } from '../memory-store';
import { createQueueEngine } from '../engine';
import { drainQueue } from '../sync';

const mkEngine = () => createQueueEngine(createMemoryStore(), () => Date.now());

test('drains accept then status in order', async () => {
  const e = mkEngine();
  await e.enqueue('accept', 'o1');
  await e.enqueue('status', 'o1', { status: 'in_transit_to_pickup' });
  const calls: string[] = [];
  const api = {
    accept: async (id: string) => {
      calls.push('accept:' + id);
    },
    reject: async () => {},
    updateStatus: async (id: string, s: string) => {
      calls.push('status:' + id + ':' + s);
    },
  } as any;
  const done = await drainQueue(e, api, () => {});
  expect(calls).toEqual(['accept:o1', 'status:o1:in_transit_to_pickup']);
  expect(done).toBe(2);
  expect(await e.size()).toBe(0);
});

test('a 400 conflict drops the op and reports it', async () => {
  const e = mkEngine();
  await e.enqueue('status', 'o1', { status: 'picked_up' });
  const conflicts: any[] = [];
  const api = {
    accept: async () => {},
    reject: async () => {},
    updateStatus: async () => {
      throw { status: 400 };
    },
  } as any;
  await drainQueue(e, api, (c) => conflicts.push(c));
  expect(await e.size()).toBe(0);
  expect(conflicts).toHaveLength(1);
});

test('a network error keeps the op for a later retry', async () => {
  const e = mkEngine();
  await e.enqueue('accept', 'o1');
  const api = {
    accept: async () => {
      throw new TypeError('Network request failed');
    },
    reject: async () => {},
    updateStatus: async () => {},
  } as any;
  await drainQueue(e, api, () => {});
  expect(await e.size()).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @kiwi/driver-mobile run test -- sync`
Expected: FAIL.

- [ ] **Step 3: Implement sync + sqlite store**

```ts
// apps/driver-mobile/src/queue/sync.ts
import type { Op } from './types';
type Engine = {
  peek(): Promise<Op | null>;
  complete(id: string): Promise<void>;
  fail(id: string, permanent: boolean): Promise<void>;
};
type OrdersApi = {
  accept(id: string): Promise<any>;
  reject(id: string): Promise<any>;
  updateStatus(id: string, s: any): Promise<any>;
};
type Conflict = { op: Op; status: number; body: any };
const isPermanent = (status: number) =>
  status >= 400 && status < 500 && status !== 408 && status !== 429;
export async function drainQueue(
  engine: Engine,
  api: OrdersApi,
  onConflict: (c: Conflict) => void,
): Promise<number> {
  let done = 0;
  for (;;) {
    const op = await engine.peek();
    if (!op) break;
    try {
      if (op.kind === 'accept') await api.accept(op.orderId);
      else if (op.kind === 'reject') await api.reject(op.orderId);
      else await api.updateStatus(op.orderId, op.payload.status);
      await engine.complete(op.id);
      done++;
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 0;
      if (status && isPermanent(status)) {
        onConflict({ op, status, body: e.body });
        await engine.fail(op.id, true);
      } else {
        await engine.fail(op.id, false);
        break;
      } // network/5xx: stop and retry later
    }
  }
  return done;
}
```

```ts
// apps/driver-mobile/src/queue/sqlite-store.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Op, QueueStore } from './types';
export function createSqliteStore(db: SQLiteDatabase): QueueStore {
  return {
    all: async () =>
      (await db.getAllAsync<any>('SELECT * FROM ops')).map((r) => ({
        id: r.id,
        kind: r.kind,
        orderId: r.order_id,
        payload: r.payload ? JSON.parse(r.payload) : undefined,
        createdAt: r.created_at,
        attempts: r.attempts,
      })),
    add: async (op) => {
      await db.runAsync(
        'INSERT INTO ops (id, kind, order_id, payload, created_at, attempts) VALUES (?,?,?,?,?,?)',
        [
          op.id,
          op.kind,
          op.orderId,
          op.payload ? JSON.stringify(op.payload) : null,
          op.createdAt,
          op.attempts,
        ],
      );
    },
    remove: async (id) => {
      await db.runAsync('DELETE FROM ops WHERE id = ?', [id]);
    },
    update: async (op) => {
      await db.runAsync('UPDATE ops SET attempts = ? WHERE id = ?', [op.attempts, op.id]);
    },
  };
}
export const OPS_SCHEMA =
  'CREATE TABLE IF NOT EXISTS ops (id TEXT PRIMARY KEY, kind TEXT, order_id TEXT, payload TEXT, created_at INTEGER, attempts INTEGER)';
```

- [ ] **Step 4: Run tests + type-check + commit**

Run: `npm --workspace @kiwi/driver-mobile run test -- sync && npm --workspace @kiwi/driver-mobile run type-check`
Expected: PASS + tsc exit 0.

```bash
git add apps/driver-mobile/src/queue
git commit -m "feat(driver-mobile): queue drain with conflict handling and sqlite store"
```

---

### Task 8: Realtime socket (factory inyectable) + mapeo de eventos

**Files:**

- Create: `apps/driver-mobile/src/realtime/socket.ts`
- Test: `apps/driver-mobile/src/realtime/__tests__/socket.test.ts`

**Interfaces:**

- Consumes: `socket.io-client`.
- Produces: `createRealtime(ioFactory, wsUrl, getToken, handlers)` → `{ connect(): void; disconnect(): void }`; handlers: `onNewOrder(o)`, `onOrderTaken({id, silent?})`, `onStatusChanged(o)`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/driver-mobile/src/realtime/__tests__/socket.test.ts
import { createRealtime } from '../socket';

function fakeSocket() {
  const listeners: Record<string, Function> = {};
  return {
    on(ev: string, cb: Function) {
      listeners[ev] = cb;
      return this;
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
    io: { on: jest.fn() },
    fire(ev: string, data: any) {
      listeners[ev]?.(data);
    },
  };
}

test('routes order:create and order:taken to handlers', async () => {
  const sock = fakeSocket();
  const ioFactory = () => sock as any;
  const got: any = {};
  const rt = createRealtime(ioFactory, 'ws://x', async () => 'tok', {
    onNewOrder: (o) => (got.new = o),
    onOrderTaken: (o) => (got.taken = o),
    onStatusChanged: () => {},
  });
  rt.connect();
  sock.fire('order:create', { id: 'o1' });
  sock.fire('order:taken', { id: 'o1', silent: true });
  expect(got.new).toEqual({ id: 'o1' });
  expect(got.taken).toEqual({ id: 'o1', silent: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @kiwi/driver-mobile run test -- socket`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/driver-mobile/src/realtime/socket.ts
import type { Socket } from 'socket.io-client';
type IoFactory = (url: string, opts: any) => Socket;
export interface RealtimeHandlers {
  onNewOrder: (o: any) => void;
  onOrderTaken: (o: { id?: string; orderId?: string; silent?: boolean }) => void;
  onStatusChanged: (o: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}
export function createRealtime(
  ioFactory: IoFactory,
  wsUrl: string,
  getToken: () => Promise<string | null>,
  h: RealtimeHandlers,
) {
  let socket: Socket | null = null;
  return {
    connect() {
      void (async () => {
        const token = await getToken();
        socket = ioFactory(wsUrl, {
          auth: { token, role: 'driver' },
          transports: ['websocket'],
          reconnection: true,
        });
        socket.on('connect', () => h.onConnect?.());
        socket.on('disconnect', () => h.onDisconnect?.());
        socket.on('order:create', h.onNewOrder);
        socket.on('order:taken', h.onOrderTaken);
        socket.on('order:statusUpdate', h.onStatusChanged);
      })();
    },
    disconnect() {
      socket?.disconnect();
      socket = null;
    },
  };
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npm --workspace @kiwi/driver-mobile run test -- socket`
Expected: PASS.

```bash
git add apps/driver-mobile/src/realtime
git commit -m "feat(driver-mobile): realtime socket wrapper with injectable io factory"
```

---

### Task 9: Ubicación en segundo plano (cluster/throttle puro + tarea adaptadora)

**Files:**

- Create: `apps/driver-mobile/src/location/batch.ts`
- Create: `apps/driver-mobile/src/location/task.ts`
- Test: `apps/driver-mobile/src/location/__tests__/batch.test.ts`

**Interfaces:**

- Produces:
  - `LocationBatcher({ minIntervalMs, maxDistanceMeters })` → `{ push(loc, now): loc | null }` (devuelve el loc a enviar o `null` si se descarta por throttle/distancia).
  - `startLocationTask(wsUrl)`, `stopLocationTask()` (adaptador expo-location + task-manager).

- [ ] **Step 1: Write the failing test**

```ts
// apps/driver-mobile/src/location/__tests__/batch.test.ts
import { LocationBatcher } from '../batch';
const loc = (lat: number, lng: number) => ({ lat, lng });
test('drops updates within the time window', () => {
  const b = new LocationBatcher({ minIntervalMs: 10000, maxDistanceMeters: 0 });
  expect(b.push(loc(10, -85), 0)).toEqual(loc(10, -85));
  expect(b.push(loc(10.0001, -85), 5000)).toBeNull();
  expect(b.push(loc(10.0002, -85), 11000)).not.toBeNull();
});
test('sends early when moved more than maxDistance (approx)', () => {
  const b = new LocationBatcher({ minIntervalMs: 60000, maxDistanceMeters: 100 });
  expect(b.push(loc(10.15, -85.45), 0)).not.toBeNull();
  expect(b.push(loc(10.152, -85.45), 5000)).not.toBeNull(); // ~220m
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @kiwi/driver-mobile run test -- batch`
Expected: FAIL.

- [ ] **Step 3: Implement batcher + task**

```ts
// apps/driver-mobile/src/location/batch.ts
export type Loc = { lat: number; lng: number };
const R = 6371000;
function meters(a: Loc, b: Loc) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export class LocationBatcher {
  private last: Loc | null = null;
  private lastAt = -Infinity;
  constructor(private cfg: { minIntervalMs: number; maxDistanceMeters: number }) {}
  push(loc: Loc, now: number): Loc | null {
    if (!this.last) {
      this.last = loc;
      this.lastAt = now;
      return loc;
    }
    const moved = meters(this.last, loc);
    const due = now - this.lastAt >= this.cfg.minIntervalMs;
    if (due || moved >= this.cfg.maxDistanceMeters) {
      this.last = loc;
      this.lastAt = now;
      return loc;
    }
    return null;
  }
}
```

```ts
// apps/driver-mobile/src/location/task.ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
export const LOCATION_TASK = 'kiwi-driver-location';
// La tarea nativa sólo recolecta; el envío (socket/REST) lo hace el foreground
// component que lee el último fix. Mantener el side-effect mínimo y testeable.
TaskManager.defineTask(LOCATION_TASK, async () => {
  /* no-op: el envío se hace en app */
});
export async function startLocationTask() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') return false;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 20000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
  });
  return true;
}
export async function stopLocationTask() {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
}
```

- [ ] **Step 4: Run tests + type-check + commit**

Run: `npm --workspace @kiwi/driver-mobile run test -- batch && npm --workspace @kiwi/driver-mobile run type-check`
Expected: PASS + tsc exit 0.

```bash
git add apps/driver-mobile/src/location
git commit -m "feat(driver-mobile): location batcher and background task adapter"
```

---

### Task 10: Registro de push (payload puro + adaptador expo-notifications)

**Files:**

- Create: `apps/driver-mobile/src/notifications/register.ts`
- Test: `apps/driver-mobile/src/notifications/__tests__/register.test.ts`

**Interfaces:**

- Produces: `platformFromOs(os: string): 'ios'|'android'`; `buildTokenPayload(os, token)`; `registerPush(notificationsApi, getDevicePushToken, os)`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/driver-mobile/src/notifications/__tests__/register.test.ts
import { platformFromOs, buildTokenPayload, registerPush } from '../register';
test('maps OS to platform', () => {
  expect(platformFromOs('ios')).toBe('ios');
  expect(platformFromOs('android')).toBe('android');
});
test('builds endpoint payload', () => {
  expect(buildTokenPayload('android', 'abc')).toEqual({ token: 'abc', platform: 'android' });
});
test('registerPush posts the native token', async () => {
  const api = { registerDevice: jest.fn(async () => {}) } as any;
  await registerPush(api, async () => ({ data: 'native-token' }) as any, 'android');
  expect(api.registerDevice).toHaveBeenCalledWith('native-token', 'android');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @kiwi/driver-mobile run test -- register`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/driver-mobile/src/notifications/register.ts
export function platformFromOs(os: string): 'ios' | 'android' {
  return os === 'ios' ? 'ios' : 'android';
}
export function buildTokenPayload(os: string, token: string) {
  return { token, platform: platformFromOs(os) };
}
export async function registerPush(
  api: { registerDevice(t: string, p: 'ios' | 'android'): Promise<void> },
  getNativeToken: () => Promise<{ data: string }>,
  os: string,
) {
  const { data } = await getNativeToken();
  await api.registerDevice(data, platformFromOs(os));
}
```

```ts
// apps/driver-mobile/src/notifications/useNativeToken.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
export const getDevicePushToken = () => Notifications.getDevicePushTokenAsync();
export const currentOs = () => Platform.OS;
```

- [ ] **Step 4: Run tests + commit**

Run: `npm --workspace @kiwi/driver-mobile run test -- register`
Expected: PASS.

```bash
git add apps/driver-mobile/src/notifications
git commit -m "feat(driver-mobile): push token registration via existing FCM endpoint"
```

---

### Task 11: Sesión (Zustand) + pantalla de Login

**Files:**

- Create: `apps/driver-mobile/src/session/store.ts`
- Create: `apps/driver-mobile/app/(auth)/login.tsx`
- Create: `apps/driver-mobile/app/index.tsx` (modificar: redirección)
- Test: `apps/driver-mobile/src/session/__tests__/store.test.ts`

**Interfaces:**

- Consumes: `authApi` (Task 4), `secureStorage` (Task 3).
- Produces: `useSession` store: `{ user, online, hydrated, signIn(email,pass), hydrate(), setOnline(b), signOut() }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/driver-mobile/src/session/__tests__/store.test.ts
import { createSessionStore } from '../store';

test('signIn stores tokens and user', async () => {
  const storage = {
    getAccess: async () => null,
    getRefresh: async () => null,
    setTokens: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  } as any;
  const api = {
    login: jest.fn(async () => ({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u1', role: 'driver' },
    })),
    profile: jest.fn(),
  } as any;
  const store = createSessionStore({ storage, api });
  await store.getState().signIn('juan@kiwi.app', '123456');
  expect(storage.setTokens).toHaveBeenCalledWith({ access: 'a', refresh: 'r' });
  expect(store.getState().user).toMatchObject({ id: 'u1' });
});
test('hydrate without a token leaves the user null', async () => {
  const storage = {
    getAccess: async () => null,
    getRefresh: async () => null,
    setTokens: async () => {},
    clear: async () => {},
  } as any;
  const api = { profile: jest.fn() } as any;
  const store = createSessionStore({ storage, api });
  await store.getState().hydrate();
  expect(store.getState().hydrated).toBe(true);
  expect(store.getState().user).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @kiwi/driver-mobile run test -- store`
Expected: FAIL.

- [ ] **Step 3: Implement store + login screen + redirect**

```ts
// apps/driver-mobile/src/session/store.ts
import { createStore } from 'zustand/vanilla';
type Deps = { storage: any; api: any };
export function createSessionStore({ storage, api }: Deps) {
  return createStore<{
    user: any;
    online: boolean;
    hydrated: boolean;
    signIn(e: string, p: string): Promise<void>;
    hydrate(): Promise<void>;
    setOnline(b: boolean): void;
    signOut(): Promise<void>;
  }>((set) => ({
    user: null,
    online: false,
    hydrated: false,
    async signIn(email, password) {
      const r = await api.login(email, password);
      await storage.setTokens({ access: r.accessToken, refresh: r.refreshToken });
      set({ user: r.user });
    },
    async hydrate() {
      const t = await storage.getAccess();
      if (!t) {
        set({ hydrated: true });
        return;
      }
      try {
        const user = await api.profile();
        if (user?.role !== 'driver') {
          await storage.clear();
          set({ user: null, hydrated: true });
          return;
        }
        set({ user, hydrated: true });
      } catch {
        await storage.clear();
        set({ user: null, hydrated: true });
      }
    },
    setOnline(b) {
      set({ online: b });
    },
    async signOut() {
      await storage.clear();
      set({ user: null, online: false });
    },
  }));
}
```

```tsx
// apps/driver-mobile/app/(auth)/login.tsx
import { useState } from 'react';
import { TextInput, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useSession } from '../../src/session/useSession';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const signIn = useSession((s) => s.signIn);
  const router = useRouter();
  return (
    <Screen>
      <View style={{ gap: tokens.space[4], marginTop: tokens.space[8] }}>
        <Text style={{ color: tokens.color.ink, fontSize: 24, fontWeight: '700' }}>
          Kiwi Repartidores
        </Text>
        <TextInput
          placeholder="tu@email.com"
          placeholderTextColor={tokens.color.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="email"
          style={{
            backgroundColor: tokens.color.surface,
            color: tokens.color.ink,
            borderRadius: tokens.radius.md,
            padding: 14,
          }}
        />
        <TextInput
          placeholder="••••••••"
          placeholderTextColor={tokens.color.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="password"
          style={{
            backgroundColor: tokens.color.surface,
            color: tokens.color.ink,
            borderRadius: tokens.radius.md,
            padding: 14,
          }}
        />
        <Button
          label="Iniciar Sesión"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await signIn(email.trim(), password);
              router.replace('/(app)');
            } catch {
              Alert.alert('No se pudo iniciar sesión');
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Screen>
  );
}
```

```ts
// apps/driver-mobile/src/session/useSession.ts  (hook sobre el store singleton)
import { useStore } from 'zustand';
import { createSessionStore } from './store';
import { secureStorage } from '../api/storage';
import { authApi } from '../api/auth';
import { http } from '../api/client';
export const sessionStore = createSessionStore({ storage: secureStorage, api: authApi(http) });
export const useSession = <T>(sel: (s: any) => T) => useStore(sessionStore, sel);
```

```ts
// apps/driver-mobile/src/api/client.ts  (singleton del http — ver Task 3)
import { createHttp } from './http';
import { secureStorage } from './storage';
import { authApi } from './auth';
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4100/api';
export const http = createHttp({
  baseUrl: BASE,
  getAccessToken: () => secureStorage.getAccess(),
  refresh: async () => {
    const r = await secureStorage.getRefresh();
    if (!r) return null;
    try {
      const out = await authApi(fetchHttp).refresh(r);
      await secureStorage.setTokens({ access: out.accessToken });
      return out.accessToken;
    } catch {
      await secureStorage.clear();
      return null;
    }
  },
});
// fetchHttp: http sin refresh, para no recursar
import { createHttp as makeHttp } from './http';
export const fetchHttp = makeHttp({
  baseUrl: BASE,
  getAccessToken: () => secureStorage.getAccess(),
  refresh: async () => null,
});
```

```tsx
// apps/driver-mobile/app/index.tsx  (redirección)
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { tokens } from '@kiwi/mobile-ui';
import { useSession } from '../src/session/useSession';
export default function Index() {
  const router = useRouter();
  const { user, hydrated, hydrate } = useSession((s) => s);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (hydrated) router.replace(user ? '/(app)' : '/(auth)/login');
  }, [hydrated, user, router]);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.canvas,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={tokens.color.kiwi} />
    </View>
  );
}
```

- [ ] **Step 4: Run tests + type-check + commit**

Run: `npm --workspace @kiwi/driver-mobile run test -- store && npm --workspace @kiwi/driver-mobile run type-check`
Expected: PASS + tsc exit 0.

```bash
git add apps/driver-mobile/src/session apps/driver-mobile/src/api/client.ts apps/driver-mobile/app
git commit -m "feat(driver-mobile): session store, login screen and auth redirect"
```

---

### Task 12: Home — toggle online/offline + Disponibles (realtime + query)

**Files:**

- Create: `apps/driver-mobile/app/(app)/_layout.tsx`
- Create: `apps/driver-mobile/app/(app)/index.tsx`
- Create: `apps/driver-mobile/src/query/queryClient.ts`

**Interfaces:**

- Consumes: `ordersApi`, `createRealtime`, `useSession`, queue engine, `screen`.
- Produces: Home con lista en vivo; aceptar/rechazar encola en offline y ejecuta online.

- [ ] **Step 1: QueryClient + layout con guard**

```ts
// apps/driver-mobile/src/query/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5000 } },
});
```

```tsx
// apps/driver-mobile/app/(app)/_layout.tsx
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '../../src/session/useSession';
export default function AppLayout() {
  const { user, hydrated } = useSession((s) => s);
  const router = useRouter();
  useEffect(() => {
    if (hydrated && !user) router.replace('/(auth)/login');
  }, [hydrated, user, router]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Home screen (lista + toggle + realtime)**

```tsx
// apps/driver-mobile/app/(app)/index.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Screen, Button, StatusBadge, tokens } from '@kiwi/mobile-ui';
import { ordersApi } from '../../src/api/orders';
import { http } from '../../src/api/client';
import { useSession } from '../../src/session/useSession';
import { createRealtime } from '../../src/realtime/socket';
import { io } from 'socket.io-client';
const api = ordersApi(http);
const WS = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4100/api').replace('/api', '');
export default function Home() {
  const router = useRouter();
  const qc = useQueryClient();
  const { online, setOnline } = useSession((s) => s);
  const [orders, setOrders] = useState<any[]>([]);
  const { data } = useQuery({
    queryKey: ['available', online],
    queryFn: () => api.available(),
    enabled: online,
  });
  useEffect(() => {
    if (Array.isArray(data)) setOrders(data);
  }, [data]);
  useEffect(() => {
    const rt = createRealtime(
      io as any,
      WS,
      () => require('../../src/api/storage').secureStorage.getAccess(),
      {
        onNewOrder: (o) =>
          setOrders((prev) =>
            prev.some((x) => x.id === (o.id ?? o.orderId)) ? prev : [o, ...prev],
          ),
        onOrderTaken: ({ id, orderId }) =>
          setOrders((prev) => prev.filter((o) => o.id !== (id ?? orderId))),
        onStatusChanged: () => {},
      },
    );
    if (online) rt.connect();
    return () => rt.disconnect();
  }, [online]);
  const accept = useCallback(
    async (id: string) => {
      await api.accept(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      router.push(`/(app)/order/${id}`);
    },
    [router],
  );
  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.space[4],
        }}
      >
        <Text style={{ color: tokens.color.ink, fontWeight: '700', fontSize: 18 }}>
          {online ? 'En línea' : 'Desconectado'}
        </Text>
        <Switch value={online} onValueChange={setOnline} />
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.lg,
              padding: tokens.space[4],
              marginBottom: tokens.space[3],
            }}
          >
            <StatusBadge status={item.status ?? 'pending'} />
            <Text style={{ color: tokens.color.ink, marginTop: 8, fontWeight: '600' }}>
              {item.merchant?.businessName ?? item.pickupAddress}
            </Text>
            <Text style={{ color: tokens.color.muted, fontSize: 12 }}>{item.deliveryAddress}</Text>
            <View style={{ marginTop: tokens.space[3] }}>
              <Button label="Aceptar" onPress={() => accept(item.id)} />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: tokens.color.muted }}>
            {online ? 'Sin pedidos disponibles' : 'Conectate para recibir pedidos'}
          </Text>
        }
      />
    </Screen>
  );
}
```

- [ ] **Step 3: Montar providers en el root layout**

Modificar `app/_layout.tsx` para envolver con `QueryClientProvider` (`queryClient` de Task 12) y `SafeAreaProvider`.

- [ ] **Step 4: Type-check + smoke**

Run: `npm --workspace @kiwi/driver-mobile run type-check`
Expected: exit 0. (Manual: la lista carga y el switch conecta el socket.)

- [ ] **Step 5: Commit**

```bash
git add apps/driver-mobile/app apps/driver-mobile/src/query
git commit -m "feat(driver-mobile): home with online toggle and live available orders"
```

---

### Task 13: Pedido activo — transiciones + foto de entrega (cámara) + offline

**Files:**

- Create: `apps/driver-mobile/app/(app)/order/[id].tsx`
- Create: `apps/driver-mobile/src/queue/useQueue.ts` (instancia del engine + sqlite + sync)
- Create: `apps/driver-mobile/src/order/useActiveOrder.ts`

**Interfaces:**

- Consumes: `transitions` (Task 5), `ordersApi`, `queue engine`+`drainQueue` (Tasks 6–7), `expo-camera`.
- Produces: pantalla de pedido activo que avanza estados; si offline, encola; para `delivered`, exige foto.

- [ ] **Step 1: Queue runtime (sqlite + engine + drain on reconnect)**

```ts
// apps/driver-mobile/src/queue/useQueue.ts
import * as SQLite from 'expo-sqlite';
import { createSqliteStore, OPS_SCHEMA } from './sqlite-store';
import { createQueueEngine } from './engine';
import { drainQueue } from './sync';
import { ordersApi } from '../api/orders';
import { http } from '../api/client';
const db = SQLite.openDatabaseSync('kiwi-driver.db');
db.execSync(OPS_SCHEMA);
const engine = createQueueEngine(createSqliteStore(db), () => Date.now());
const api = ordersApi(http);
export const queue = {
  enqueue: engine.enqueue,
  size: engine.size,
  async flush() {
    return drainQueue(engine, api, () => {});
  },
};
```

- [ ] **Step 2: Active order screen**

```tsx
// apps/driver-mobile/app/(app)/order/[id].tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Screen, Button, StatusBadge, tokens } from '@kiwi/mobile-ui';
import * as ImagePicker from 'expo-image-picker';
import { ordersApi } from '../../../src/api/orders';
import { http } from '../../../src/api/client';
import { queue } from '../../../src/queue/useQueue';
import { nextStatus, canAdvance } from '../../../src/order/transitions';
const api = ordersApi(http);
export default function ActiveOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [current, setCurrent] = useState('assigned');
  const [busy, setBusy] = useState(false);
  const advance = async () => {
    const check = canAdvance(current, { pickupProofReady: true });
    if (!check.ok) {
      Alert.alert(
        check.reason === 'waiting_pickup_proof'
          ? 'Esperando la foto de retiro del comercio'
          : 'El pedido ya terminó',
      );
      return;
    }
    const n = nextStatus(current);
    if (!n) return;
    setBusy(true);
    try {
      if (n === 'delivered') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Necesitás permitir la cámara para la foto de entrega');
          return;
        }
        const shot = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (shot.canceled) return;
        const uri = shot.assets[0].uri;
        const form = new FormData();
        form.append('kind', 'delivery');
        form.append('photo', { uri, name: 'delivery.jpg', type: 'image/jpeg' } as any);
        await api.uploadProof(id, form);
      }
      try {
        await api.updateStatus(id, n as any);
      } catch (e: any) {
        if (e?.status && e.status >= 500) {
          await queue.enqueue('status', id, { status: n });
        } else if (!e?.status) {
          await queue.enqueue('status', id, { status: n });
        } else {
          throw e;
        }
      }
      setCurrent(n);
      if (n === 'delivered') router.replace('/(app)');
    } catch (e: any) {
      Alert.alert('No se pudo actualizar', e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <StatusBadge status={current} />
      <Text
        style={{
          color: tokens.color.ink,
          fontSize: 20,
          fontWeight: '700',
          marginVertical: tokens.space[4],
        }}
      >
        Pedido #{String(id).slice(0, 8)}
      </Text>
      <View style={{ marginTop: 'auto' }}>
        <Button
          label={current === 'in_transit_to_delivery' ? 'Marcar entregado (foto)' : 'Avanzar'}
          loading={busy}
          onPress={advance}
        />
      </View>
    </Screen>
  );
}
```

- [ ] **Step 3: Flush the queue on reconnect**

En `app/(app)/_layout.tsx` agregar listener de `@react-native-community/netinfo` que al volver `isConnected` llama `queue.flush()`.

- [ ] **Step 4: Type-check + smoke en dispositivo (Android)**

Run: `npm --workspace @kiwi/driver-mobile run type-check && npm --workspace @kiwi/driver-mobile run android`
Expected: ciclo completo (asignado → … → entregado) con foto; y con aeroplano a mitad, la operación queda en cola y se envía al volver la red.

- [ ] **Step 5: Commit**

```bash
git add apps/driver-mobile/app apps/driver-mobile/src/order apps/driver-mobile/src/queue
git commit -m "feat(driver-mobile): active order flow with delivery photo and offline queue"
```

---

### Task 14: Perfil mínimo + logout, y registro de push al iniciar sesión

**Files:**

- Create: `apps/driver-mobile/app/(app)/profile.tsx`
- Modify: `apps/driver-mobile/app/(app)/_layout.tsx` (registrar push + netinfo)

**Interfaces:**

- Consumes: `useSession`, `notificationsApi`, `registerPush`, `getDevicePushToken`, `currentOs`.

- [ ] **Step 1: Profile screen**

```tsx
// apps/driver-mobile/app/(app)/profile.tsx
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Button, tokens } from '@kiwi/mobile-ui';
import { useSession } from '../../src/session/useSession';
export default function Profile() {
  const { user, signOut } = useSession((s) => s);
  const router = useRouter();
  return (
    <Screen>
      <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: '700' }}>
        {user?.driverProfile?.fullName ?? user?.email}
      </Text>
      <Text style={{ color: tokens.color.muted, marginTop: 4 }}>{user?.email}</Text>
      <View style={{ marginTop: 'auto' }}>
        <Button
          label="Cerrar sesión"
          variant="danger"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
        />
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Register push once authenticated**

En `app/(app)/_layout.tsx`, cuando `user` existe y es `driver`, llamar `registerPush(notificationsApi(http), getDevicePushToken, currentOs())` (una vez, guardado con un ref).

- [ ] **Step 3: Type-check + commit**

Run: `npm --workspace @kiwi/driver-mobile run type-check`
Expected: exit 0.

```bash
git add apps/driver-mobile/app apps/driver-mobile/src/notifications
git commit -m "feat(driver-mobile): minimal profile, logout and push registration on login"
```

---

### Task 15: EAS builds (iOS+Android), README y CI

**Files:**

- Create: `apps/driver-mobile/eas.json`
- Create: `apps/driver-mobile/README.md`
- Modify: `.github/workflows/*` (agregar job de lint/type-check/tests de la app) — seguir el patrón de los jobs existentes.

**Interfaces:**

- Produces: perfiles EAS `development`/`preview`/`production`; CI que corre `mobile-ui` + `driver-mobile` tests y type-check.

- [ ] **Step 1: eas.json**

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

- [ ] **Step 2: README**

Documentar: requisitos (Node 20, EAS CLI, cuenta Apple para APNs), `EXPO_PUBLIC_API_URL`, cómo correr dev client en iOS/Android, y el prerequisito de **APNs key en Firebase** para push iOS.

- [ ] **Step 3: CI job**

Agregar un job `mobile` al workflow que hace `npm ci`, luego `npm --workspace @kiwi/mobile-ui run test && npm --workspace @kiwi/mobile-ui run type-check && npm --workspace @kiwi/driver-mobile run test && npm --workspace @kiwi/driver-mobile run type-check`.

- [ ] **Step 4: Verify + commit**

Run: `npm --workspace @kiwi/driver-mobile run type-check && npm --workspace @kiwi/driver-mobile run test`
Expected: PASS.

```bash
git add apps/driver-mobile/eas.json apps/driver-mobile/README.md .github/workflows
git commit -m "chore(driver-mobile): EAS build profiles, README and CI checks"
```

---

## Self-Review

**1. Spec coverage**

- §1 Goal / §6 features → Tasks 11–14 (auth, turno, disponibles, activo+foto, push, ubicación, perfil).
- §5 structure (mobile-ui + driver-mobile, NativeWind, secure storage) → Tasks 1–4.
- §7 offline (cola SQLite + FIFO + conflicto) → Tasks 6–7, 13.
- §4 verified constraints (photo gating, FCM endpoint) → Tasks 5, 10, 13.
- §8 edges (GPS, cámara, 401, cancelado) → Tasks 3 (401 refresh), 9 (permiso GPS), 13 (cámara/cola).
- §9 testing/DoD → tests por tarea + Task 15 CI + manual en Task 13.
- §10 prerequisites / §11 rollout → Task 15 (README/EAS) + checklist manual.
- §2 non-goals → no se incluyen ganancias/retiros/KYC/horario/analytics.

**2. Placeholder scan:** sin TBD/TODO; cada paso con código real o comando exacto.

**3. Type consistency:** `Http` (Task 3) usado en Tasks 4/11/12/13; `DriverOrderStatus` (Task 4) en Tasks 5/13; `Op`/`QueueStore` (Task 6) en Task 7/13; `createRealtime` handlers (Task 8) en Task 12; `registerPush`/`platformFromOs` (Task 10) en Task 14; `secureStorage` (Task 3) reusado en client/session.

**Nota de simplificación:** el plan asume que `api/client.ts` (singleton del http) se crea en Task 11 (porque el refresh usa `authApi`); Task 3 deja `createHttp` listo y Task 11 lo instancia. Si se prefiere, mover la creación del singleton a Task 3 — no cambia firmas.
