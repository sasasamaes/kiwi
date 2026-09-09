# 🥝 Kiwi — Guía de Despliegue

## 🏗️ Arquitectura de Producción

| Servicio                  | Plataforma        | URL                                |
| ------------------------- | ----------------- | ---------------------------------- |
| 🗄️ API (NestJS)           | Render            | https://kiwi-api-fe54.onrender.com |
| 🍃 Dashboard Comerciantes | Vercel            | https://kiwi-merchant.vercel.app   |
| 📱 Menú QR Clientes       | Vercel            | https://kiwi-client-tau.vercel.app |
| 🛵 App Repartidores       | Vercel            | https://kiwi-driver.vercel.app     |
| 🗃️ Base de datos          | Render PostgreSQL | (interno, vía `DATABASE_URL`)      |

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
JWT_EXPIRES_IN="7d"
NODE_ENV="production"
SEED_DEMO_DATA="true"                  # false para un DB limpio
# Integraciones opcionales:
# SENTRY_DSN, FIREBASE_*, ONVOPAY_API_KEY, ...
```

En los frontends (Vercel → Project → Settings → Environment Variables):

```bash
NEXT_PUBLIC_API_URL="https://kiwi-api-fe54.onrender.com/api"
```

---

## 🛡️ Security headers

Cada app define sus headers en su propio `vercel.json` (CSP con allowlist por app, HSTS con preload, `X-Frame-Options`, `Permissions-Policy`, etc.). Al editarlos, redespliega la app para que apliquen.

---

## 🔍 Verificación post-deploy

```bash
# API viva
curl -s https://kiwi-api-fe54.onrender.com/api/payments/methods -o /dev/null -w "%{http_code}\n"

# Headers de seguridad aplicados
curl -sI https://kiwi-merchant.vercel.app | grep -i strict-transport

# Prueba E2E completa (login, menú, ciclo de pedidos)
node scripts/e2e-prod-flow.mjs https://kiwi-api-fe54.onrender.com/api
```

---

## 🧯 Troubleshooting

| Problema                                                              | Solución                                                                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| La API devuelve 500 en rutas de datos                                 | Revisa `DATABASE_URL` en Render y los logs de arranque; el boot auto-ejecuta migraciones si faltan tablas                                 |
| El primer pedido tras un deploy falla                                 | Ya resuelto: el gateway de eventos es null-safe; si reaparece, revisa `api/src/events/events.gateway.ts`                                  |
| Build falla en Vercel por `framer-motion` u otra dependencia fantasma | Asegúrate de que cada paquete declare en su `package.json` todo lo que importa (no dependas del hoisting)                                 |
| `process is not defined` en el navegador                              | Nunca uses `process.env?.X` ni variables sin prefijo `NEXT_PUBLIC_` en código de cliente; CI lo bloquea con `npm run check:client-bundle` |
| El deploy de Vercel no toma los headers nuevos                        | Confirma que editaste el `vercel.json` del app correcto y redespliega                                                                     |
