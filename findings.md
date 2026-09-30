# Audit Findings

## Repository context

- Monorepo: npm workspaces + Turborepo.
- Merchant frontend: `apps/web`. Driver PWA: `apps/driver`.
- Shared API/realtime/offline package: `packages/ui`. Backend: NestJS + Prisma in `api`.
- Baseline: full API suite 347/347 green before changes.

## Confirmed screenshot error

- Missing `CLOUDINARY_URL` in Render → `isConfigured=false` → 503 with the exact red message; merchant page surfaced it as a global banner.
- Docs fix: `DEPLOYMENT.md` now documents `CLOUDINARY_URL` and the `image-status` check.

## Fixed lifecycle bugs

1. **Scheduled orders invisible to drivers.** `GET /orders/available?scheduled=true` ignored the flag and returned immediate `pending` orders. Driver scheduled page therefore never saw `driver_proposals`. Fixed in `orders.controller.ts` + `orders.service.ts` (`getAvailableOrders(lat, lng, {scheduled})`); default path unchanged.
2. **no_driver dead end.** Sweeper moved expired contests to `no_driver` with no outgoing transition, so merchants could neither retry nor cancel. Added `no_driver → pending` (with fresh contest window + fleet re-alert) and `no_driver → cancelled`, merchant-owned. Merchant orders page gained Reintentar/Cancelar for `no_driver`.
3. **Upload fragility (merchant + driver).** FileInterceptors claimed memoryStorage but never set it — now explicit in both controllers. Client now pre-validates 5MB + jpeg/png/webp/gif (iPhone HEIC gives a clear message instead of a late 400), restricts the picker accept list, clears the stale global error on success, and uploads have the same 25s timeout as the rest of the client.

## Not changed / watch items

- Server magic-bytes + 5MB validation remains the source of truth.
- Driver cannot see merchant phone (only pickup address) — left as-is; flag if drivers need a call-commerce path.
- Proof-photo overwrite has no status guard — left as-is to keep the fix minimal.
