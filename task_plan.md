# Paridad móvil nativa (Expo) — 2026-10-20

## Goal

Llevar las 3 apps nativas (`merchant-mobile`, `driver-mobile`, `client-mobile`) a paridad funcional con sus webs antes del lanzamiento. Admin/backoffice (`apps/web/app/admin/*`) queda solo web por decisión explícita.

## Scope por app

- **merchant-mobile**: menú (CRUD + disponibilidad), crédito prepago (saldo/historial/recarga), analytics, avisos a seguidores, perfil del negocio, KYC (estado + verificación), programados/crear pedido. Ya tiene: login, comandas KDS, detalle, repartidores, notificaciones, perfil básico.
- **driver-mobile**: ganancias + retiro, KYC, registro. Ya tiene: login, ofertas en vivo, detalle, perfil.
- **client-mobile**: encomiendas, zona azul, feature flags + ComingSoon, banners. Ya tiene: auth, comercios, QR, menú, checkout, tracking, rate, pedidos, perfil.
- **Fase D (requiere al usuario)**: `eas init` (cuenta Expo), `buildType: apk` en preview, `EXPO_PUBLIC_API_URL` prod, build + QA en Android físico.

## Fases

1. **Fase A merchant-mobile** — menu, credits, analytics, announce, profile extendido, kyc. Status: complete (6 módulos api + tests 34/34, 6 pantallas, BottomNav + hub, i18n ES/EN).
2. **Fase B driver-mobile** — earnings/withdraw, kyc, register, nav. Status: complete (2 módulos api + tests 21/21, 3 pantallas, profile hub, i18n ES/EN).
3. **Fase C client-mobile** — encomienda, zona-azul, flags/ComingSoon, banners. Status: complete (2 módulos api + tests 48/48, 3 pantallas, gate, comercios, i18n ES/EN).
4. **Fase D EAS APK + QA físico** — Status: en curso (3 apps linkeadas a org KiWi; builds APK comercios + repartidor + cliente lanzados; falta QA en físico).
5. **Mandados** — Status: complete (backend: migración, `POST /orders/mandado`, `PUT /orders/:id/receipt`, flag `mandadosEnabled`; web cliente: tarjeta + página; móvil cliente: entrada + pantalla + gate; repartidor web + móvil: tarjeta de compra + registro de factura; i18n ES/EN; tests api 599/599).
6. **Liquidación mar–lun + recibos** — Status: complete (backend: migración WithdrawalItem + periodStart/End, planilla semanal, generación con recibo, recibo en approve, `GET/POST admin/payroll`, recibos admin/driver; admin web: sección planilla + recibo imprimible; repartidor web + móvil: ver recibo; i18n ES/EN; tests api 613/613).

## Decisiones

- Reutilizar endpoints existentes (ya envueltos en `packages/ui/api-client`); en móvil solo wrappers finos sobre `mobile-core` + pantallas con `mobile-ui`.
- i18n: namespaces planos existentes en `packages/i18n` (`menu`, `earnings`, `analytics`, `kyc`, `credits` nuevo, etc.), ES + EN siempre a la par.
- Convenciones: `Stack` sin header, `mobile-ui` (`Screen`, `Header`, `Button`, `Field`), token en secure-store, tests en `__tests__` junto a cada api.

---

# Merchant–Driver Workflow Audit

## Goal

Audit and resolve reproducible failures affecting the merchant and driver order lifecycle, with evidence from tests and builds.

## Scope

Merchant order visibility/creation → driver assignment and acceptance → pickup evidence/status → delivery evidence/status. Out of scope unless blocking: payments, analytics, admin, accounts.

## Phases

1. **Project context and evidence** — inspect repo state, architecture, recent changes, test commands, workflow entry points. Status: complete.
2. **Failure analysis** — trace boundaries (merchant UI/API, driver UI/API, realtime/offline queue) and run the existing tests to establish a baseline. Status: complete.
3. **Targeted fixes** — for each confirmed bug, add a failing regression test first, implement the smallest root-cause fix, and verify it. Status: complete.
4. **Final verification** — run relevant tests/type-check/builds and inspect final diff. Status: complete.

## Next Step

Done. Audit fixes committed in fc85b19; final full API re-run green (399/399). Uncommitted work in tree (variant maxSelections + menu UI) left untouched.

## Decisions Made

- Treat the Cloudinary error as a configuration path to verify; do not request or repeat credentials in chat.
- Fix the no_driver dead end with merchant-owned retry/cancel (pending/cancelled) plus fresh contest window and fleet re-alert.
- Fix scheduled discovery with ?scheduled=true returning driver_proposals instead of immediate pending orders.
- Keep default getAvailableOrders behavior unchanged when the flag is absent.
- Validate photo size/type on the client before upload and add upload timeouts; keep server magic-bytes + 5MB as source of truth.

## Errors Encountered

| Error                                       | Attempt | Resolution                                                               |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| New regression spec failed 3/4 on first run | 1       | Expected RED; implemented minimal service + controller fixes, all 4 pass |
| api has no type-check script                | 1       | Used npx tsc --noEmit -p tsconfig.json per app/package                   |
