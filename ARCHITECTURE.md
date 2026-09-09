# 🥝 Kiwi — Arquitectura del Sistema

> Plataforma de repartos que conecta comercios locales con repartidores, con pedidos desde menú QR, pagos múltiples y operación offline-first.

---

## 1. Visión general

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  apps/web       │   │  apps/client    │   │  apps/driver    │
│  Dashboard      │   │  Menú QR        │   │  App Repartidor │
│  Comerciantes   │   │  (clientes)     │   │  (PWA offline)  │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │  HTTPS + REST       │                     │  HTTPS + WebSocket
         └──────────────┬──────┴─────────────────────┘
                        ▼
              ┌───────────────────┐      ┌──────────────────────┐
              │   API NestJS      │      │  Servicios externos  │
              │  (Socket.io GW)   │◄────►│  OnvoPay / Stellar   │
              └─────────┬─────────┘      │  Nominatim / OSRM    │
                        │ Prisma         │  Firebase (push)     │
                        ▼                │  Sentry / PostHog    │
              ┌───────────────────┐      └──────────────────────┘
              │  PostgreSQL       │
              └───────────────────┘
```

Monorepo **npm workspaces + Turborepo**: tres frontends Next.js, un backend NestJS y paquetes compartidos.

---

## 2. Estructura del repositorio

```
kiwi/
├── apps/
│   ├── web/        # Dashboard comerciantes (Next.js, puerto 3000)
│   ├── driver/     # App repartidores (Next.js PWA, puerto 3001)
│   └── client/     # Menú QR clientes (Next.js, puerto 3002)
├── api/            # Backend NestJS + Prisma (dev: PORT=3000, ¡colisiona con apps/web — arrancar web primero o cambiar PORT!)
├── packages/
│   ├── ui/         # Componentes React + lógica offline compartida
│   ├── i18n/       # Internacionalización (es/en) + useTranslation
│   ├── types/      # Tipos TypeScript compartidos
│   ├── db/         # Cliente Prisma singleton (legado, ver §4)
│   └── config/     # Configs compartidas (eslint, typescript)
├── scripts/        # deploy.sh, e2e-prod-flow.mjs, check-client-bundle.mjs
└── turbo.json
```

---

## 3. Las aplicaciones

### 🍃 `apps/web` — Dashboard comerciantes

Gestión de menú, pedidos entrantes, analíticas de ventas, retiros (`withdrawals`) y configuración del comercio. Autenticación JWT con rol `merchant`.

### 📱 `apps/client` — Menú QR

Página pública por comercio: catálogo, carrito, checkout con múltiples métodos de pago y seguimiento del pedido en vivo. Diseñada para abrirse escaneando un QR en el local (por eso `X-Frame-Options: SAMEORIGIN` y `camera=(self)`).

### 🛵 `apps/driver` — App repartidor

PWA **offline-first**: acepta pedidos, navega con mapa (Leaflet + tiles OpenStreetMap, rutas vía OSRM), actualiza estado del reparto y registra ubicación. La cola de operaciones sin conexión (`offline-queue`, `background-sync`, `unified-cache`) se sincroniza al recuperar red. Es la experiencia canónica de repartidor; no existe app nativa.

### Paquete clave: `packages/ui`

No son solo componentes visuales — concentra la lógica transversal usada por las tres apps:

- **API/realtime**: `api-client.ts` (REST, base `NEXT_PUBLIC_API_URL`), `socket-client.ts` + `useSocket.ts` (WebSocket hacia la API).
- **Offline**: cola de sincronización, caché unificado con compresión, resolución de conflictos, pagos y navegación sin conexión.
- **Pagos**: `PaymentSelector`, `OnvoPayCheckout`.
- **Infra**: `AuthContext`, `ThemeProvider`, `LanguageProvider`, integraciones Sentry/PostHog/Firebase (todas lazy y con guards).

> ⚠️ Regla aprendida en producción: todo lo que importa un paquete debe estar declarado en el `package.json` de ese paquete — no confiar en el hoisting de npm (rompe builds en Vercel).

---

## 4. Paquetes compartidos

| Paquete        | Contenido                                               | Estado                                                                             |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `@kiwi/ui`     | Componentes + lógica offline/realtime/pagos             | Activo, usado por las 3 apps                                                       |
| `@kiwi/i18n`   | `useTranslation`, locales `es`/`en`, `LanguageSwitcher` | Activo                                                                             |
| `@kiwi/types`  | Tipos compartidos                                       | Activo                                                                             |
| `@kiwi/db`     | Singleton de `PrismaClient`                             | **Legado**: nadie lo importa; su `schema.prisma` ha derivado del canónico (ver §6) |
| `@kiwi/config` | Presets de eslint/typescript                            | Referenciado por configs                                                           |

---

## 5. API (NestJS)

### Módulos (`api/src/`)

| Módulo                            | Responsabilidad                                                     |
| --------------------------------- | ------------------------------------------------------------------- |
| `auth`                            | Registro/login, JWT, guards por rol (`merchant`, `driver`, `admin`) |
| `users` / `merchants` / `drivers` | Perfiles por rol, niveles y estado de conductores                   |
| `kyc`                             | Verificación de identidad de repartidores                           |
| `menu`                            | CRUD de `MenuItem` por comercio (público para lectura)              |
| `orders`                          | Creación, asignación, ciclo de vida y transiciones de estado        |
| `events`                          | **Gateway Socket.io**: rooms por usuario/rol/tópico                 |
| `payments`                        | OnvoPay + Stellar (quote/crypto), webhooks por proveedor            |
| `withdrawals`                     | Solicitud/aprobación de retiros de conductores                      |
| `geocoding`                       | Búsqueda geográfica vía **Nominatim** (OpenStreetMap)               |
| `routing`                         | Cálculo de rutas / distancias (precios por km)                      |
| `notifications`                   | Push (Firebase) + email/SMS                                         |
| `analytics`                       | Métricas por comercio, conductor y plataforma                       |
| `security`                        | Rate limiting por ruta, sanitización de inputs, security headers    |
| `prisma` / `config` / `common`    | Infraestructura transversal                                         |

### Arranque (`main.ts`)

- Prefijo global `/api`; Swagger en `/docs`.
- CORS con allowlist (localhost 3000–3002 + `CLIENT_URL`/`WEB_URL`).
- `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`.
- Sentry solo si `SENTRY_DSN` está definido.
- **Auto-sanación de DB**: al boot comprueba el esquema; si faltan tablas ejecuta `prisma migrate deploy`, y si la base está vacía aplica el seed de demo (`SEED_DEMO_DATA=false` para desactivar).

### Ciclo de vida de un pedido

```
pending → (driver_proposals, solo pedidos scheduled) → assigned
        → in_transit_to_pickup → picked_up → in_transit_to_delivery → delivered
                                    ↘ cancelled
```

`OrdersService` valida cada transición (`validateStatusTransition`) y estampa timestamps (`assignedAt`, `pickedUpAt`, `deliveredAt`). El precio de envío se calcula por distancia (ej. ≤2 km → ₡1000).

### Realtime (`EventsGateway`)

- Rooms: `user:{id}`, `role:{rol}`, `topic:{tópico}`.
- Eventos de entrada: `order:create`, `order:accept`, `order:statusUpdate`, `driver:locationUpdate`, `driver:statusChange`, `notification:subscribe`.
- Salida vía `sendToUser` / `sendToRole` / `sendToTopic` — **null-safe**: si ningún cliente está conectado, no crashea (los métodos se invocan desde flujos REST como la creación de pedidos).

---

## 6. Modelo de datos (Prisma)

**Schema canónico: `api/prisma/schema.prisma`** (con migraciones en `api/prisma/migrations/`). El de `packages/db` es una copia derivada que **no** debe editarse.

Entidades principales:

- **Usuarios y perfiles**: `User` (rol: `merchant | driver | admin`), `MerchantProfile`, `DriverProfile` (vehículo, nivel, estado), `KYCVerification`.
- **Operación**: `Order` + `OrderItem` + `MenuItem`, `DriverProposal` (pujas para pedidos programados), `DriverSchedule`.
- **Dinero**: `Payment` (métodos: SINPE, tarjeta, efectivo, crypto; estados por proveedor), `Withdrawal` (solicitud → aprobación → completado/rechazo), `DriverIncentive`.
- **Comunidad**: `Rating`, `FavoriteDriver`, `Notification`.

---

## 7. Flujos de datos principales

### Pedido desde el QR

1. Cliente escanea QR → `apps/client` carga menú público del comercio.
2. Checkout → `POST /api/orders` (o `order:create` por socket) → precio por distancia, estado `pending`.
3. La API difunde el pedido a los repartidores conectados (socket, room `role:driver`) y al comercio (room `user:{merchantId}`).
4. Repartidor acepta (`order:accept`) → `assigned`, se registra `assignedAt`.
5. Transiciones de reparto por socket o REST → el cliente sigue el pedido en vivo (mapa + estado) vía socket.
6. `delivered` → `Payment` se liquida según método; el conductor acumula balance para retiros.

### Offline (repartidor)

Las acciones sin red (cambios de estado, formularios) entran a la cola local → `background-sync` las replays al reconectar → `useConflictResolution` resuelve divergencias con el servidor (el estado del servidor manda salvo conflicto marcado).

### Pagos

`payments.controller` expone métodos, webhooks (`/api/payments/webhook/:provider`) y quote cripto. Proveedores detrás de una interfaz común: `onvopay.provider.ts` (fiat/SINPE) y `stellar.provider.ts` (crypto). Los webhooks actualizan `Payment.status` y disparan notificaciones.

---

## 8. Infraestructura de producción

| Servicio    | Plataforma                                | URL                                                         |
| ----------- | ----------------------------------------- | ----------------------------------------------------------- |
| API         | **Render** (auto-deploy en push a `main`) | https://kiwi-api-fe54.onrender.com                          |
| PostgreSQL  | **Render** (misma cuenta, `DATABASE_URL`) | interno                                                     |
| 3 frontends | **Vercel** (Root Directory por app)       | kiwi-merchant / kiwi-client-tau / kiwi-driver `.vercel.app` |

- **Security headers por app** en cada `vercel.json`: CSP con allowlist por dominio (API, socket, PostHog, Sentry, Firebase, tiles OSM; OSRM solo en driver), HSTS con preload, `X-Frame-Options`, `Permissions-Policy` por rol.
- **Frontends → API**: variable `NEXT_PUBLIC_API_URL=https://kiwi-api-fe54.onrender.com/api` (los sockets derivan de la misma base quitando `/api`).
- **CI (GitHub Actions)**: cuatro jobs — _Dead Host Guard_ (falla si archivos rastreados referencian hosts muertos de la era Railway/Supabase, incluido el dominio propio nunca registrado; `npm run check:dead-hosts`), _Client Bundle Safety_ (build + escaneo de `process`/`import.meta.env` en bundles de cliente; ver `scripts/check-client-bundle.mjs`), _Test & Build_ (`prisma generate` → 53 tests → `nest build`) y _E2E Flow_ (Postgres efímero en service container → migrate → seed → API boot → `scripts/e2e-prod-flow.mjs`, 31 pasos). Los tres jobs con dependencias comparten la action `.github/actions/setup-deps` con caché de npm + caché de `node_modules` (salta `npm ci` si hay hit, clave = lockfile + OS).
- **Prueba E2E de producción**: `node scripts/e2e-prod-flow.mjs [url]` — login, CRUD de menú y ciclo completo de pedido contra cualquier entorno.

### Variables críticas

| Variable                        | Dónde             | Uso                                |
| ------------------------------- | ----------------- | ---------------------------------- |
| `DATABASE_URL`                  | Render (API)      | PostgreSQL                         |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Render (API)      | Sesiones                           |
| `SEED_DEMO_DATA`                | Render (API)      | `false` = DB limpia sin datos demo |
| `NEXT_PUBLIC_API_URL`           | Vercel (cada app) | Base de la API                     |
| `SENTRY_DSN`, Firebase, OnvoPay | Render/Vercel     | Integraciones opcionales           |

---

## 9. Deudas y notas conocidas

- **`@kiwi/db`** es código muerto: nadie lo importa y su schema derivó (falta la relación `kycVerification` en `MerchantProfile`). Candidato a eliminar o re-unificar con `api/prisma`.
- **CSP** usa `'unsafe-inline'`/`'unsafe-eval'` en `script-src` (requisito actual de Next sin nonce/middleware).
- **Lint en builds**: los tres apps saltan el lint durante `next build` (errores preexistentes); el lint corre aparte vía `npm run lint`.
- `apps/driver/public/sw.js` es un artefacto regenerable de next-pwa; no editar a mano.
