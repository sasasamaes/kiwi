# Kiwi Clientes — Client mobile app

Expo (SDK 57) + Expo Router app for Kiwi customers. Covers the customer journey:
QR scan, merchant menu, cart, pickup/shipping checkout, payments, scheduled
delivery, order tracking with a map, order history and ratings. Guest-first and
offline-first. Shared theme/components live in `packages/mobile-ui`; shared
runtime helpers live in `packages/mobile-core`.

## Requirements

- **Node >= 20** and npm (this is an npm workspace; run commands from the repo root).
- **EAS CLI** (`npm install -g eas-cli`) and an Expo account for dev/preview/production builds.
- **Apple Developer account** with an **APNs key** created and **loaded into the Firebase
  project** used by this app. This is **required for iOS push**: the backend sends push
  through the existing FCM endpoint, which in turn delivers to iOS via APNs. Without a
  valid APNs key in Firebase, iOS devices will not receive notifications.
- **Android push** uses FCM as well (Google service account credentials on the backend).
- **A physical device** for push and map testing (see below).

## Environment

- `EXPO_PUBLIC_API_URL` — base URL of the API, including the `/api` suffix.
  Default: `http://localhost:4100/api`.
- `EXPO_PUBLIC_MAP_STYLE` — optional MapLibre style URL override for the tracking
  map. Defaults to the public OpenFreeMap demo style (no API key required).

Set it before starting Metro, e.g.:

```sh
EXPO_PUBLIC_API_URL=http://192.168.1.20:4100/api npx expo start --dev-client
```

Use your machine's LAN IP (not `localhost`) when running on a device, so the device can
reach the API.

## EAS build profiles

Configured in `eas.json`:

- `development` — development client, internal distribution (dev build with all native
  modules: camera, push, MapLibre).
- `preview` — internal distribution, for QA on real devices.
- `production` — production build with `autoIncrement` for store submission.
- `submit.production` — submission config for the production profile.

Build a dev client and install it on a device:

```sh
# from apps/client-mobile
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

## Running the dev client (iOS + Android)

After installing the EAS `development` build on your device:

```sh
# from apps/client-mobile
npx expo start --dev-client
```

Then scan the QR code with the installed dev client (iOS: Camera app; Android: the dev
client app). To target a specific platform simulator/emulator use `--ios` / `--android`.

> **Expo Go is not enough.** Push notifications (`expo-notifications` with FCM/APNs via a
> native device token) and the tracking map require native code: the map uses
> `@maplibre/maplibre-react-native`, a **native module** whose config plugin is declared
> in `app.json` (`"@maplibre/maplibre-react-native"`). Both only work in a **custom dev
> build on a real device**, not in Expo Go.

## MapLibre (tracking map) — requires a dev build

The tracking map uses `@maplibre/maplibre-react-native`, a **native module**, so a
**prebuild / dev build** is required:

```bash
npx expo prebuild            # generates ios/ and android/ applying the plugin
npx expo run:ios             # or: npx expo run:android
# or with EAS:
eas build --profile development --platform ios
```

Native steps the plugin applies (automatic in the prebuild):

- **iOS**: pod global `$MLRN_NATIVE_VERSION` + `post_install` (pod `MapLibre`) and `DWARF_DSYM`.
- **Android**: Gradle properties for `org.maplibre.gl:android-sdk-*` (OpenGL variant by default).

In a headless environment `src/components/TrackingMap.tsx` still type-checks and the pure
ETA (`src/tracking/eta.ts`) is tested without native modules.

## Local checks

From the repo root:

```sh
npm --workspace @kiwi/client-mobile run type-check
npm --workspace @kiwi/client-mobile run test
```

These same checks (plus the `@kiwi/mobile-ui` and `@kiwi/mobile-core` package checks, and
`@kiwi/driver-mobile`) run in CI in the `mobile` job.

## Structure

```
app/(public)/   comercios, scan, menu/[id], checkout, tracking/[id], rate/[id]
app/(account)/  orders, profile
app/(auth)/     login, register
src/api/        menu, orders, payments, geocoding, follows, ratings, notifications, auth
src/cart/       math + store + useCart (SQLite persisted)
src/notifications/  push device-token registration (expo-notifications)
src/order/      idempotency, offline queue, schedule
src/payments/   return-URL parser + hosted checkout
src/tracking/   eta (pure) + useTracking
src/session/    store (guest-first) + useSession
```
