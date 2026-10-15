# Zonas/Barrios editables desde el admin — Design

- Date: 2026-10-16
- Status: approved by owner, pending spec review
- Context: hoy el catálogo de zonas de entrega es **hardcodeado** en `@kiwi/types`
  (espejo `api/src/orders/delivery-zones.ts`) y usado por todas las apps + el pricing.
  Esta feature lo mueve a la **DB** con **CRUD desde el admin** (incluye **polígonos**).
- Sources: `packages/types/src/deliveryZones.ts`, `api/src/orders/delivery-zones.ts`,
  `api/src/orders/orders.service.ts`, `api/src/geocoding`, `packages/ui` (ZonePicker,
  DeliveryZoneSelect, DeliveryZonesMap), `apps/web/app/admin`.

## 1. Goal

Permitir al **admin** crear/editar/desactivar zonas (barrios) con **lat/long**, **precio** y
**polígono** opcional, persistidas en la DB; que el **pricing** y `nearest-zone` del API lean
de ahí (con caché), y que las apps muestren las zonas **desde el API** (sin redeploy).

## 2. Non-goals

- No PostGIS / índices espaciales (punto-en-polígono en Node).
- No tarifas por horario/clima; no zonas por comercio (siguen siendo globales de Nicoya).
- No se rompen pedidos existentes: `Order.deliveryZone` sigue guardando id/label.

## 3. Decisions (cerradas con el owner)

| Tema             | Decisión                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Fuente de verdad | **DB** (`DeliveryZone`), seed desde el catálogo actual                                                |
| Campos           | label, lat, lng, price, **geometry (GeoJSON)**, referenceOnly, active, sortOrder                      |
| Polígonos        | **Sí** (permite cobro automático por cercanía)                                                        |
| Solapamiento     | Gana la zona de **menor área**; sin polígono → **sugerir** la referencia más cercana (sin cobro auto) |
| Apps             | Traen zonas del **API** con el **catálogo como fallback**                                             |
| Borrado          | **Soft** (`active=false`)                                                                             |

## 4. Modelo y seed

```prisma
model DeliveryZone {
  id            String   @id @default(uuid())
  label         String
  latitude      Decimal? @db.Decimal(10, 8)
  longitude     Decimal? @db.Decimal(10, 8)
  price         Decimal  @db.Decimal(10, 2)
  geometry      Json?            // GeoJSON Polygon | MultiPolygon
  referenceOnly Boolean  @default(true) @map("reference_only")
  active        Boolean  @default(true)
  sortOrder     Int      @default(0) @map("sort_order")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  @@map("delivery_zones")
}
```

- **Migration** `delivery_zones` (vacía).
- **Seed idempotente** `api/prisma/seed-delivery-zones.mjs` (o dentro del seed): inserta las
  zonas de `NICOYA_DELIVERY_ZONES` (por `label`), `referenceOnly: true`, `geometry: null`,
  sin tocar las que ya existan (para no pisar ediciones del admin).

## 5. API

- **Público**: `GET /delivery-zones` → zonas `active`, shape `{ id, label, latitude, longitude, price, geometry, referenceOnly }`.
- **Admin** (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`):
  - `GET /delivery-zones/all` (incluye inactivas)
  - `POST /delivery-zones` (crea; valida)
  - `PUT /delivery-zones/:id` (edita)
  - `DELETE /delivery-zones/:id` (soft → `active=false`)
- **ZonesService**: cachea la lista activa (TTL corto, ~30s) y **invalida** al mutar.
  Expone: `list()`, `listAll()`, `create()`, `update()`, `deactivate()`,
  `resolvePrice(lat,lng)` y `nearest(lat,lng)`.

## 6. Cálculo (puro, testeable) — `api/src/orders/zone-geometry.ts`

- `pointInPolygon(point, ring)`, `pointInGeometry(point, geometry)` (Polygon/MultiPolygon; ray-casting).
- `geometryArea(geometry)` (anillo exterior por shoelace; suficiente para comparar).
- **`resolvePrice(zones, point)`**:
  1. Filtra zonas con geometry que **contienen** el punto.
  2. Si hay ≥1 → devuelve la de **menor área** (auto, `source: 'polygon'`).
  3. Si no → `nearest(zones, point)` por haversine → `source: 'reference'` (sugerencia, sin auto-cobro).
  4. Sin zonas → `null`.
- `orders.service` y `geocoding.nearest-zone` usan `ZonesService` (async) en vez del catálogo constante.

## 7. Apps

- `packages/ui/api-client`: `getDeliveryZones()` → `GET /delivery-zones`.
- `ZonePicker` / `DeliveryZoneSelect` / `DeliveryZonesMap`: usan zonas del **API** (query con
  fallback a `NICOYA_DELIVERY_ZONES` si falla o está vacío).
- Pricing de UI (`findDeliveryZone(...)`) sigue con el catálogo para mostrar; el **server**
  revalida con la DB (fuente de verdad).

## 8. Admin UI — `/admin/zones`

- Tabla: nombre, precio, ¿polígono?, activo; acciones editar/desactivar.
- Form + **mapa de dibujo** (Leaflet + plugin de dibujo, reusando Leaflet ya presente):
  polígono (Polygon/MultiPolygon) + punto de referencia, precio, activo, orden.
- Validación: ≥3 puntos, anillo cerrado, sin auto-intersección básica; si no hay polígono → `referenceOnly=true`.
- Nav: entrada "Zonas" en el panel admin.

## 9. Errores y bordes

- Zona sin geometría → solo referencia (sugerencia).
- Pedido viejo con `deliveryZone` de una zona desactivada → no rompe (string guardado).
- Editar precio no afecta pedidos ya creados (el precio se congela al crear).
- Polígono inválido → 400 con mensaje.
- Sin geometrías nuevas → el sistema se comporta como hoy (referencia).

## 10. Testing / DoD

- **Unit**: point-in-polygon (dentro/fuera/borde), "menor área gana", `resolvePrice` con
  reference fallback.
- **API**: CRUD admin (200/403 por rol), `GET /delivery-zones` público, invalidación de caché.
- **Admin**: crear zona con polígono → `GET /delivery-zones` la devuelve; el checkout del
  cliente cobra esa zona para un punto dentro del polígono.
- **Apps**: si `/delivery-zones` falla, el selector cae al catálogo (sin romper).

## 11. Rollout

1. Migración + seed → la DB replica el catálogo (nada cambia para el usuario).
2. Deploy API (Render) + frontends.
3. El admin ya puede crear/editar; un barrio nuevo aparece sin redeploy.

## 12. Fuera de alcance / futuro

- PostGIS + índices espaciales; zonas por comercio; tarifas dinámicas (hora/clima).
