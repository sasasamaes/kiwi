# Onvo Marketplace: repartidores (flete/express) — Design

- Date: 2026-10-11
- Status: approved by owner, pending spec review
- Parent: `2026-10-11-onvo-marketplace-payouts-design.md` (merchant split). This spec
  extends the same rails to drivers. No changes to the merchant flow.
- Sources: `docs.onvopay.com/payments/marketplaces.md`, OpenAPI (no payouts API),
  existing flete pricing (`orderType: 'express'`, driver 85% / Kiwi 15%).

## 1. Goal

Drivers doing express/flete receive the delivery fee in their own IBAN via an Onvo
connected account, with Kiwi's 15% flete commission kept automatically
(`marketplaceAppFee: 15`, the existing commission).

## 2. Non-goals

- No per-order double split: one charge = one seller. In merchant orders the whole
  charge (products + shipping) keeps going `onBehalfOf` the merchant; driver
  balance + manual withdrawals unchanged there.
- No weekly fee. No KYC outside Onvo-hosted onboarding.
- No changes to contest/assignment, tracking, or ratings.

## 3. Verified constraints (research)

- Onvo has no transfer/payout endpoint to connected accounts (OpenAPI paths
  audited 2026-10-11; only automatic per-account settlement + weekly fees).
- Settlement per account goes to the IBAN from onboarding; `409` if already done.
- Test/live modes are separate keys and accounts.

## 4. Changes in Kiwi

- `DriverProfile`: `onvoConnectedAccountId String?`, `onvoOnboardingStatus String?`
  (Prisma migration).
- Reuse `MarketplaceService` pattern for drivers (new `DriverMarketplaceService`
  or parameterized service — implementation plan decides; no duplicated Onvo calls):
  create account (`businessName` = driver fullName, fee 15), refresh status
  (active → driver can receive express charges), regenerate link.
- Driver routes (role `driver`): `POST /drivers/me/marketplace/onboarding`,
  `GET /drivers/me/marketplace/status`, `POST /drivers/me/marketplace/onboarding-link`.
- Express checkout: when the assigned driver has an `active` connected account,
  create the session with `onBehalfOf` = driver account; otherwise current
  behavior (fee to merchant / manual driver withdrawals).
- Driver app: "Cobros" section in profile (same 3 states as merchant panel:
  activate → pending with reopen/done → active ✓) + visible liquidaciones list
  (seller intents, same endpoint pattern as merchants).

## 5. Errors and edges

- Driver not `active` at charge time → no `onBehalfOf` (fail closed, manual flow).
- Expired link → regenerate from the app. `409` → refresh and continue.
- `onboardingUrl` sensitive: owner-only response, never logged.
- Cash express orders: untouched (no Onvo movement).

## 6. Testing

- Jest specs (service: create/refresh/regen/charge-arg; charge: express session
  carries driver account, fallback without it).
- `tsc` + full API suite green.
- Test mode: connected test account, test onboarding, ₡1.000 express checkout with
  `onBehalfOf`, webhook completed, split visible in Onvo test dashboard.
- Manual: driver test account walks pending → active in the driver app.

## 7. Rollout

1. Test mode E2E. 2) Live keys. 3) Pilot with 1 driver on real express orders.
2. Rest of fleet via in-app onboarding.

## 8. Decisions

- Express `onBehalfOf` driver with fee 15 (= existing flete commission) — confirm.
- Manual withdrawals stay as fallback — confirm.
- Pilot driver: owner picks at rollout (operational step, no code impact) — confirm.
