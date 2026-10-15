# Mercadito Zona Azul — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`). Small feature: 3 tasks.

**Goal:** Alta del producto (par de cuajadas ₡2000, stock 60) en el comercio del dueño + sección `/zona-azul` en el cliente con la descripción Blue Zone.

**Architecture:** Script Node (fetch) que usa la API para crear el `MenuItem` (idempotente-básico); página Next.js en `apps/client` que lista la categoría del comercio configurado por env.

**Tech Stack:** Node 20 (script), Next.js 15 + Tailwind (client), API NestJS existente.

## Global Constraints

- Precio del ítem = **2000** (par de 2); categoría **"Mercadito Zona Azul"**; **stockQty 60**.
- Comercio del dueño: `sasasamaes13@gmail.com`; el id para el cliente va en **`NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID`**.
- No tocar otras apps/paquetes. Sin secretos en el repo. Commits conventional.

---

### Task Z1: Script de alta de datos

**Files:** Create `scripts/seed-mercadito-zona-azul.mjs`
**Interfaces:** `PUT /auth/login` → token; `GET /merchants/me` → perfil; `GET /menu/my`; `POST /menu/my`; `PUT /menu/my/:id`.

- [ ] Leer `API_URL` (default `http://localhost:4100/api`), `E2E_MERCHANT_EMAIL`, `E2E_PASSWORD`.
- [ ] Login; `GET /merchants/me` (si falla → cortar: "esa cuenta no tiene perfil de comercio").
- [ ] `GET /menu/my`; si existe un item con `category === 'Mercadito Zona Azul'` y el mismo nombre → `PUT` (no duplica); si no → `POST`.
- [ ] Imprimir el **merchantId** y el resultado.
- [ ] Verificar contra API local con `luis@kiwi.app`; correr 2× (no duplica).
- [ ] Commit `feat(mercadito): seed script for Zona Azul products`.

### Task Z2: Sección `/zona-azul` + acceso en el home

**Files:** Create `apps/client/app/zona-azul/page.tsx`; Modify `apps/client/app/page.tsx`

- [ ] Página: lee `NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID`; si falta → "Próximamente".
- [ ] Fetch `getMerchantPublicProfile(id)` + `getMerchantMenuItems(id)`; filtra `category === 'Mercadito Zona Azul'`.
- [ ] Render: encabezado del comercio, tarjetas de producto (nombre, ₡, descripción, "Par · 2 unidades"), CTA a `/menu/{id}`, y bloque de copy Blue Zone.
- [ ] Home: tarjeta "Mercadito Zona Azul 🥝" → `/zona-azul`.
- [ ] Verificar: `cd apps/client && npx tsc --noEmit` y `npx next build` OK.
- [ ] Commit `feat(client): Mercadito Zona Azul section`.

### Task Z3: Rollout

- [ ] Documentar en el README/spec cómo correr el script y setear la env en Vercel.
- [ ] Commit `docs(mercadito): rollout notes`.

## Self-Review

- Spec §4 → Z1; §5 → Z2; §6 copy → Z2; §7 → Z1 (idempotente) + Z2 ("Próximamente"); §8 → Z1/Z2 verificación; §9 → Z3.
- Sin placeholders; copy Blue Zone incluido en el spec y en Z2.
