# Kiwi Clientes — App móvil (Expo)

App nativa iOS + Android para clientes de Kiwi (Expo SDK 57, Expo Router, NativeWind, TanStack Query).

## Requisitos

- Node >= 20
- Expo SDK 57 (react 19.2.x, react-native 0.86.x)
- `EXPO_PUBLIC_API_URL` apuntando al API (ej. `http://localhost:4100/api`)

## Scripts

```bash
npm --workspace @kiwi/client-mobile run type-check
npm --workspace @kiwi/client-mobile run test
npm --workspace @kiwi/client-mobile run start
```

## MapLibre (mapa de tracking) — requiere dev build

El mapa de seguimiento usa `@maplibre/maplibre-react-native`, un **módulo nativo**
que **no funciona en Expo Go**. Su config plugin está declarado en `app.json`
(`"@maplibre/maplibre-react-native"`), por lo que hace falta **prebuild / dev build**:

```bash
npx expo prebuild            # genera ios/ y android/ aplicando el plugin
npx expo run:ios             # o: npx expo run:android
# o con EAS:
eas build --profile development --platform ios
```

Pasos nativos que aplica el plugin (automáticos en el prebuild):

- **iOS**: pod global `$MLRN_NATIVE_VERSION` + `post_install` (pod `MapLibre`) y `DWARF_DSYM`.
- **Android**: propiedades Gradle para `org.maplibre.gl:android-sdk-*` (variante OpenGL por defecto).

En un entorno headless el componente `src/components/TrackingMap.tsx` igual
type-checkea y el ETA puro (`src/tracking/eta.ts`) se testea sin nativos.

Opcional: sobreescribir el estilo del mapa con `EXPO_PUBLIC_MAP_STYLE` (por defecto
usa el estilo demo público de OpenFreeMap, sin API key).

## Estructura

```
app/(public)/   comercios, scan, menu/[id], checkout, tracking/[id], rate/[id]
app/(account)/  orders, profile
app/(auth)/     login, register
src/api/        menu, orders, payments, geocoding, follows, ratings, notifications, auth
src/cart/       math + store + useCart (SQLite persistido)
src/order/      idempotencia, cola offline, schedule
src/payments/   parser de retorno + checkout hosted
src/tracking/   eta (puro) + useTracking
src/session/    store (guest-first) + useSession
```
