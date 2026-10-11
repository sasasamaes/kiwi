# 🥝 Kiwi — Guía de Despliegue

## 🏗️ Arquitectura de Producción

| Servicio                  | Plataforma        | URL                                 |
| ------------------------- | ----------------- | ----------------------------------- |
| 🗄️ API (NestJS)           | Render            | https://kiwi-api-fe54.onrender.com  |
| 🍃 Dashboard Comerciantes | Vercel            | https://negocios.kiwicr.express     |
| 📱 Menú QR Clientes       | Vercel            | https://www.kiwicr.express          |
| 🛵 App Repartidores       | Vercel            | https://repartidores.kiwicr.express |
| 🗃️ Base de datos          | Render PostgreSQL | (interno, vía `DATABASE_URL`)       |

---

## 🚀 Deploy

Cada servicio se despliega automáticamente al hacer **push a `main`**:

- **API**: Render detecta el push y ejecuta `npm install && npm run build` + `npm run start:prod` (Build Command y Start Command configurados en el dashboard de Render, Root Directory `api`).
- **Frontends**: Vercel despliega cada app desde su Root Directory (`apps/web`, `apps/client`, `apps/driver`) con su propio `vercel.json` (incluye CSP, HSTS y demás security headers).

### Deploy manual de los frontends

```bash
cd apps/web && vercel --prod      # o apps/client, apps/driver
```

> El CLI usa el link del proyecto en `.vercel/project.json`; verifica con `vercel whoami` y `vercel project ls` antes de desplegar.

### Deploy manual de la API

Normalmente no hace falta: Render redespliega solo con cada push a `main`. Para forzarlo: **Render Dashboard → kiwi-api → Manual Deploy → Deploy latest commit**.

---

## 🗄️ Base de datos (Render PostgreSQL)

1. **Crear la base** en Render Dashboard → **New → PostgreSQL** (región acorde a `iad1`).
2. Copiar la **External Database URL** (o la Internal si la API corre en la misma región).
3. En el servicio de la API → **Environment →** `DATABASE_URL`.

### Migraciones y seed

La API es **auto-sanadora**: en cada arranque (`api/src/main.ts`) comprueba el esquema y, si faltan tablas, ejecuta `prisma migrate deploy`; si la base está vacía, aplica el seed de demo (datos de prueba: comercios, productos, conductores). Para desactivar el seed en producción:

```
SEED_DEMO_DATA=false
```

Para aplicar migraciones manualmente desde tu máquina (con la `DATABASE_URL` de producción):

```bash
cd api
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

---

## 🔐 Variables de entorno de la API

Configuradas en **Render Dashboard → kiwi-api → Environment**:

```bash
DATABASE_URL="postgresql://..."        # Render PostgreSQL
JWT_SECRET="..."                       # secreto fuerte, no compartir
JWT_ACCESS_EXPIRES_IN="7d"           # sesión del comercio: 1 semana logueado
JWT_REFRESH_EXPIRES_IN="7d"          # refresh rotativo, ventana deslizante de 7 días
NODE_ENV="production"
SEED_DEMO_DATA="true"                  # false para un DB limpio
CLOUDINARY_URL="cloudinary://KEY:SECRET@CLOUD"  # fotos de menú y evidencia 1+1; sin esto /menu/my/image-status da {enabled:false} y las subidas responden 503
# Integraciones opcionales:
# SENTRY_DSN, FIREBASE_*, ONVOPAY_API_KEY, ...
```

En los frontends (Vercel → Project → Settings → Environment Variables):

```bash
NEXT_PUBLIC_API_URL="https://kiwi-api-fe54.onrender.com/api"
```

### 🔔 Push (Firebase, driver + comercio)

Sin estas vars el push **no falla, se apaga en silencio** (la app avisa "Falta configuración" al activar alertas y el API solo guarda inbox). Checklist:

Vercel → **kiwi-driver** y **kiwi-merchant** → Environment Variables (las 7, mismo proyecto Firebase):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="....firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="....appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_VAPID_KEY="..."   # Cloud Messaging → Web Push certificates
```

Render → **kiwi-api** → Environment:

```bash
FIREBASE_SERVICE_ACCOUNT='{"project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----...","client_email":"..."}'  # JSON de una línea
```

Verificación con la app instalada (driver o comercio): activar alertas → si falla, el diagnóstico dice el paso exacto (`missing-vapid`, `missing-config`, `token-failed`). Diagnóstico punta a punta del lado servidor: `POST /api/notifications/test-push` (logueado) devuelve `{fcmConfigured, tokens, sent}` — si `fcmConfigured=false`, falta `FIREBASE_SERVICE_ACCOUNT` en Render; si `tokens=0`, el celu no registró token (revisar vars públicas + permiso).

---

## 🛡️ Security headers

Cada app define sus headers en su propio `vercel.json` (CSP con allowlist por app, HSTS con preload, `X-Frame-Options`, `Permissions-Policy`, etc.). Al editarlos, redespliega la app para que apliquen.

---

## 🔍 Verificación post-deploy

```bash
# API viva
curl -s https://kiwi-api-fe54.onrender.com/api/payments/methods -o /dev/null -w "%{http_code}\n"

# Headers de seguridad aplicados
curl -sI https://negocios.kiwicr.express | grep -i strict-transport

# Redirect del dominio vercel.app al propio (307 + preserva la ruta)
curl -sI https://kiwi-merchant.vercel.app | grep -i location

# Drift de esquema: detecta si el Prisma Client desplegado espera columnas
# que la BD de producción aún no tiene (causa clásica de 500 en rutas de datos
# con P2022 mientras la API arranca "bien")
curl -s https://kiwi-api-fe54.onrender.com/api/health/schema

# Prueba E2E completa (login, menú, ciclo de pedidos)
node scripts/e2e-prod-flow.mjs https://kiwi-api-fe54.onrender.com/api

# Transporte de sockets: ¿está montado socket.io de verdad?
# (falla con 503 en /api/health y detalle en /api/health/socket si no)
curl -s https://kiwi-api-fe54.onrender.com/api/health/socket
```

---

## 🧯 Troubleshooting

| Problema                                                              | Solución                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La API devuelve 500 en rutas de datos                                 | Revisa `DATABASE_URL` en Render y los logs de arranque; el boot auto-ejecuta migraciones si faltan tablas                                                                                                                                                                                                                                                                                  |
| 500 solo en rutas de orders/earnings con la API "arriba"              | Drift de columnas: abre `GET /api/health/schema` — si devuelve `drift`, la BD no tiene columnas que el Prisma Client espera; fuerza redeploy de la API (el boot aplica `prisma migrate deploy`) o ejecuta la migración a mano con la `DATABASE_URL` de producción                                                                                                                          |
| El primer pedido tras un deploy falla                                 | Ya resuelto: el gateway de eventos es null-safe; si reaparece, revisa `api/src/events/events.gateway.ts`                                                                                                                                                                                                                                                                                   |
| Build falla en Vercel por `framer-motion` u otra dependencia fantasma | Asegúrate de que cada paquete declare en su `package.json` todo lo que importa (no dependas del hoisting)                                                                                                                                                                                                                                                                                  |
| `process is not defined` en el navegador                              | Nunca uses `process.env?.X` ni variables sin prefijo `NEXT_PUBLIC_` en código de cliente; CI lo bloquea con `npm run check:client-bundle`                                                                                                                                                                                                                                                  |     | El deploy de Vercel no toma los headers nuevos | Confirma que editaste el `vercel.json` del app correcto y redespliega |
| CI falla en el job `Migrations up-to-date`                            | El schema y las migraciones no coinciden. En local: `cd api && npx prisma migrate dev --name <cambio>` y commitea la migración generada. Nunca edites `schema.prisma` sin su migración                                                                                                                                                                                                     |
| La app no recibe eventos en tiempo real (pedidos, chat)               | Transporte de sockets caído: `GET /api/health` responde **503** con el diagnóstico y `GET /api/health/socket` da el detalle (`adapter: missing` = falta `@nestjs/platform-socket.io`; `handshake: not_mounted` = express responde 404 en `/socket.io/`). En local, el adapter ausente además **crashea el boot** con `ERROR [PackageLoader] No driver (WebSockets)…` en los logs de Render |

### Sockets (por qué `/api/health` puede fallar)

### CI (GitHub Actions)

`.github/workflows/ci.yml` corre en cada PR y push a `main`:

| Job                   | Qué valida                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo Hygiene          | Hosts muertos + invariantes del schema Prisma (una sola copia)                                                                                                            |
| Client Bundle Safety  | `process.env` / secretos filtrados en bundles de cliente                                                                                                                  |
| Test & Build          | `turbo run type-check` (los 6 paquetes), tests del API, build de NestJS                                                                                                   |
| Migrations up-to-date | Aplica todas las migraciones a un Postgres fresco y verifica con `prisma migrate diff` que reproducen `schema.prisma` **sin drift** (el bug exacto que rompió producción) |
| E2E Flow              | API real contra Postgres: login → menú → ciclo completo de pedidos                                                                                                        |
