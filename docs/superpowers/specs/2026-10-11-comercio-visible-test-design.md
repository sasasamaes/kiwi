# Comercio visible/oculto (modo prueba) — Design

- Date: 2026-10-11
- Status: approved by owner, pending spec review
- Scope: test account (sasasamaes13@gmail.com) toggles its own public visibility
  to test purchases, then hides itself. No admin needed.

## 1. Goal

Self-serve "Visible en la app cliente" toggle in the merchant profile ("Mi negocio"),
backed by the existing `isListed` flag. Hidden merchants vanish from client
list/search but QR + direct menu keep working (current `setListed` semantics).

## 2. Non-goals

- No changes to what hidden means (existing semantics untouched).
- No admin flow changes (`PUT :id/visibility` stays).
- No other profile fields touched.

## 3. Changes

- `PUT /merchants/me/visibility` (role `merchant`, own profile via `user.sub` →
  `findByUserId`, reuses `setListed`). Body `{ listed: boolean }`.
- api-client: `setMyVisibility(listed)` → `PUT /merchants/me/visibility`.
- Perfil page ("Mi negocio"): toggle bound to `isListed` (from `getMerchantProfile`),
  label "Visible en la app cliente", sub "Ocultalo para probar sin que te vean".
  Inline es-CR errors, optimistic revert on failure.

## 4. Testing

- Jest: merchant A cannot change merchant B (only own id resolvable — assert
  service called with own id); toggles flag both ways.
- `tsc` api/ui/web. Manual: test account hides → gone from client list, QR works.

## 5. Decisions

- Merchant-scoped endpoint over opening the admin one (owner, 2026-10-11).
