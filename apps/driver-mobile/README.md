# Kiwi Repartidores — Driver mobile app

Expo (SDK 57) + Expo Router app for Kiwi delivery drivers. Covers the core shift:
login, online/offline, available orders, accept/reject, order status cycle with
delivery proof photo, push notifications, background location and an offline-first
queue. Shared theme/components live in `packages/mobile-ui`.

## Requirements

- **Node >= 20** and npm (this is an npm workspace; run commands from the repo root).
- **EAS CLI** (`npm install -g eas-cli`) and an Expo account for dev/preview/production builds.
- **Apple Developer account** with an **APNs key** created and **loaded into the Firebase
  project** used by this app. This is **required for iOS push**: the backend sends push
  through the existing FCM endpoint, which in turn delivers to iOS via APNs. Without a
  valid APNs key in Firebase, iOS devices will not receive notifications.
- **A physical device** for background location and push testing (see below).

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
  modules: camera, background location, push).
- `preview` — internal distribution, for QA on real devices.
- `production` — production build with `autoIncrement` for store submission.
- `submit.production` — submission config for the production profile.

Build a dev client and install it on a device:

```sh
# from apps/driver-mobile
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

## Running the dev client (iOS + Android)

After installing the EAS `development` build on your device:

```sh
# from apps/driver-mobile
npx expo start --dev-client
```

Then scan the QR code with the installed dev client (iOS: Camera app; Android: the dev
client app). To target a specific platform simulator/emulator use `--ios` / `--android`.

> **Expo Go is not enough.** Background location (`expo-task-manager` +
> `expo-location`) and push notifications (`expo-notifications` with FCM/APNs) require
> native code and entitlements, so they only work in a **custom dev build on a real
> device**. Expo Go cannot load these modules.

## Local checks

From the repo root:

```sh
npm --workspace @kiwi/driver-mobile run type-check
npm --workspace @kiwi/driver-mobile run test
```

These same checks (plus the `@kiwi/mobile-ui` package checks) run in CI in the `mobile` job.
