# Kiwi Negocios — Merchant mobile app

Expo (SDK 57) + Expo Router app for Kiwi merchants. Covers the counter workflow:
login, a live order board (KDS) with reliable alerts, order detail with status
advances and a pickup proof photo, and requesting/picking a driver. Shared
theme/components live in `packages/mobile-ui`; shared runtime helpers (http,
realtime) live in `packages/mobile-core`.

## Requirements

- **Node >= 20** and npm (this is an npm workspace; run commands from the repo root).
- **EAS CLI** (`npm install -g eas-cli`) and an Expo account for dev/preview/production builds.
- **Apple Developer account** with an **APNs key** created and **loaded into the Firebase
  project** used by this app. This is **required for iOS push**: the backend sends push
  through the existing FCM endpoint, which in turn delivers to iOS via APNs. Without a
  valid APNs key in Firebase, iOS devices will not receive notifications.
- **Android push** uses FCM as well (Google service account credentials on the backend).
- **A physical device** for push testing — notifications (`expo-notifications` with
  FCM/APNs via a native device token) require native code and entitlements, so they only
  work in a **custom dev build on a real device**, not in Expo Go or a simulator.
- **A tablet is recommended for the KDS.** The comandas board keeps the screen awake
  (`expo-keep-awake`) while it is in the foreground so a device left on the counter does
  not sleep mid-service. A tablet gives the board enough room to show all columns at once.

## Environment

- `EXPO_PUBLIC_API_URL` — base URL of the API, including the `/api` suffix.
  Default: `http://localhost:4100/api`.

Set it before starting Metro, e.g.:

```sh
EXPO_PUBLIC_API_URL=http://192.168.1.20:4100/api npx expo start --dev-client
```

Use your machine's LAN IP (not `localhost`) when running on a device, so the device can
reach the API.

## EAS build profiles

Configured in `eas.json`:

- `development` — development client, internal distribution (dev build with all native
  modules: camera, push, keep-awake).
- `preview` — internal distribution, for QA on real devices.
- `production` — production build with `autoIncrement` for store submission.
- `submit.production` — submission config for the production profile.

Build a dev client and install it on a device:

```sh
# from apps/merchant-mobile
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

## Running the dev client (iOS + Android)

After installing the EAS `development` build on your device:

```sh
# from apps/merchant-mobile
npx expo start --dev-client
```

Then scan the QR code with the installed dev client (iOS: Camera app; Android: the dev
client app). To target a specific platform simulator/emulator use `--ios` / `--android`.

> **Expo Go is not enough.** Push notifications (`expo-notifications`) and the device
> camera (`expo-image-picker`, for the pickup proof photo) require native code, so they
> only work in a **custom dev build on a real device**. Expo Go cannot load these modules.

## Local checks

From the repo root:

```sh
npm --workspace @kiwi/merchant-mobile run type-check
npm --workspace @kiwi/merchant-mobile run test
```

These same checks (plus the `@kiwi/mobile-ui`, `@kiwi/mobile-core`, `@kiwi/driver-mobile`
and `@kiwi/client-mobile` checks) run in CI in the `mobile` job.

## Structure

```
app/(auth)/     login
app/(app)/      comandas (KDS board), order/[id], drivers, notifications, profile
src/api/        auth, orders, drivers, proposals, notifications
src/comanda/    board model (pure: status→column, ordering, event reducer) + store
src/kds/        keep-awake + alert sound
src/notifications/  push device-token registration (expo-notifications)
src/realtime/   orders socket (wraps mobile-core createRealtime)
src/session/    store + useSession
```
