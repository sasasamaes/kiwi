# Zonas/Barrios editables (admin) — Implementation Plan

> Steps with checkbox (`- [ ]`). Backend-first, luego apps, luego admin UI.

**Goal:** zonas en DB con CRUD admin (incluye polígonos), pricing/nearest leen de la DB, y las apps traen las zonas del API con fallback al catálogo.

**Tech:** Prisma + Postgres, NestJS, Next.js (Leaflet + draw), TS.

## Global Constraints

- Fuente de verdad = DB. Fallback en apps = catálogo `NICOYA_DELIVERY_ZONES`.
- `orders.service` y `nearest-zone` **dejan** de leer el catálogo constante para precios.
- Polígono gana por **menor área**; sin polígono = referencia (sin cobro auto).
- Sin secretos. Commits conventional.

---

### Z1: Modelo `DeliveryZone` + migración

**Files:** `api/prisma/schema.prisma`, migración en `api/prisma/migrations/`

- [ ] Agregar el modelo (spec §4). `npx prisma migrate dev --name delivery_zones` (local) / `migrate deploy` (prod). `npx prisma generate`.
- [ ] `tsc` OK. Commit `feat(zones): DeliveryZone model + migration`.

### Z2: Geometría pura — `api/src/orders/zone-geometry.ts` + tests

**Files:** Create `zone-geometry.ts`, `api/src/__tests__/zone-geometry.spec.ts`

- [ ] `pointInPolygon`, `pointInGeometry` (Polygon/MultiPolygon), `geometryArea`, `resolveZonePrice(zones, point)`.
- [ ] Tests: dentro/fuera/borde; menor área gana; fallback referencia; sin zonas → null.
- [ ] Commit `feat(zones): pure point-in-polygon + price resolution`.

### Z3: `ZonesService` + endpoints

**Files:** Create `api/src/zones/{zones.service.ts,zones.controller.ts,zones.module.ts}` (o dentro de orders). DTOs.

- [ ] `list()` (activas), `listAll()`, `create()`, `update()`, `deactivate()`, `resolvePrice(lat,lng)`, `nearest(lat,lng)`.
- [ ] Cache TTL ~30s + invalidación al mutar.
- [ ] Controller: `GET /delivery-zones` público; `GET /delivery-zones/all|POST|PUT|DELETE` `@Roles('admin')`.
- [ ] Tests: CRUD + roles (403 no-admin) + GET público. Registrar el módulo en `app.module`.
- [ ] Commit `feat(zones): ZonesService and admin CRUD endpoints`.

### Z4: Refactor pricing/nearest a la DB

**Files:** `api/src/orders/orders.service.ts`, `api/src/geocoding/geocoding.service.ts`, `api/src/auth/auth.service.ts`, `api/src/notifications/notifications.service.ts`

- [ ] Reemplazar `findDeliveryZone/findNearestZone/getDeliveryZonePrice` (catálogo) por `ZonesService` (async) donde se calcula/valida precio. Mantener `detectDeliveryZoneFromText` como hint (texto) pero validar contra DB.
- [ ] Ajustar tests existentes que asumían el catálogo; correr suite completa (debe quedar verde).
- [ ] Commit `refactor(zones): pricing reads zones from the DB`.

### Z5: Seed de zonas

**Files:** Create `scripts/seed-delivery-zones.mjs` (o en `api/prisma/seed.ts`)

- [ ] Idempotente por `label`: inserta `NICOYA_DELIVERY_ZONES` (referenceOnly true, geometry null).
- [ ] Verificar contra API local: `GET /delivery-zones` devuelve el catálogo. Commit.

### Z6: Apps traen zonas del API

**Files:** `packages/ui/src/api-client.ts`, `packages/ui/src/ZonePicker.tsx`, `DeliveryZoneSelect`, `DeliveryZonesMap`, usos en `apps/client`, `apps/web`.

- [ ] `getDeliveryZones()`. Selectores: fetch del API con **fallback** al catálogo visible.
- [ ] `tsc` en ui/web/client; build. Commit `feat(zones): apps load zones from the API`.

### Z7: Admin `/admin/zones` con editor de mapa

**Files:** Create `apps/web/app/admin/zones/page.tsx`(+ componentes); modify nav admin.

- [ ] Tabla + form + **mapa Leaflet con dibujo** de polígono + punto/ precio/activo/orden.
- [ ] `tsc` + `next build`. Commit `feat(admin): modules zones editor`.

### Z8: Verificación + rollout

- [ ] E2E local: crear zona con polígono → `GET /delivery-zones` la trae → un pedido con punto dentro cobra esa zona.
- [ ] Docs/rollout; commit + push + deploy (API Render, web/cliente Vercel).

## Self-Review

- Spec §4→Z1/Z5; §6→Z2; §5→Z3; §6/§7→Z4; §7→Z6; §8→Z7; §10→Z2/Z3/Z8. Sin placeholders.
