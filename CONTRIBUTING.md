# 🥝 Kiwi — Guía de Contribución

> Setup local, puertos, comandos y las trampas conocidas. Para la visión general del sistema, ver [ARCHITECTURE.md](./ARCHITECTURE.md); para deploy, [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 1. Requisitos

| Herramienta | Versión  | Notas                                                         |
| ----------- | -------- | ------------------------------------------------------------- |
| Node.js     | **≥ 20** | CI usa 22; los builds de producción usan 24                   |
| npm         | **10**   | `packageManager` fijado en `package.json` — no uses yarn/pnpm |
| PostgreSQL  | **14+**  | Local para desarrollo                                         |

---

## 2. Setup inicial

```bash
# 1. Dependencias (workspaces del monorepo)
npm install

# 2. Variables de entorno de la API
cp api/.env.example api/.env
#    Edita DATABASE_URL con tu Postgres local; la API ya escucha
#    en el puerto 4000 por defecto (ver §3).

# 3. Esquema + datos demo
cd api
npx prisma generate
npx prisma migrate dev        # crea el esquema
npx prisma db seed            # comercios, productos, conductores demo
cd ..
```

> La API también **es auto-sanadora**: al arrancar aplica migraciones si faltan tablas y seedea si la base está vacía (configura `SEED_DEMO_DATA=false` para evitarlo). En desarrollo es más predecible ejecutar `migrate dev` + `db seed` a mano.

### Cuentas demo (del seed)

| Rol          | Email           | Password |
| ------------ | --------------- | -------- |
| Comercio     | `luis@kiwi.app` | `123456` |
| Repartidor   | `juan@kiwi.app` | `123456` |
| Repartidor 2 | `fran@kiwi.app` | `123456` |

---

## 3. Puertos de desarrollo

| Servicio                            | Puerto                                    |
| ----------------------------------- | ----------------------------------------- |
| `apps/web` (dashboard comerciantes) | 3000                                      |
| `apps/driver` (app repartidor)      | 3001                                      |
| `apps/client` (menú QR)             | 3002                                      |
| `api`                               | **4000** (evita la colisión con apps/web) |

Los fallbacks de `packages/ui` (`api-client`, `socket-client`) ya apuntan a `http://localhost:4000/api`; en producción cada app usa `NEXT_PUBLIC_API_URL` de Vercel.

---

## 4. Comandos

```bash
# Desarrollo (desde la raíz)
npm run dev                    # todas las apps vía turbo
npm run dev:api                # solo API (nest --watch)

# Build / calidad
npm run build                  # todo el monorepo
npm run lint                   # eslint en todos los paquetes
npm run type-check             # tsc --noEmit en todos

# Tests
cd api && npm test             # 53 tests de la API (jest)

# E2E contra tu API local (API corriendo en :3000/4000)
node scripts/e2e-prod-flow.mjs http://localhost:4000
#    (o el puerto que uses: la API local corre en 4000)
#   → 31 pasos: login, CRUD de menú, ciclo completo de pedido

# Chequeos que aplica CI en cada push
npm run check:client-bundle    # process/import.meta.env en bundles cliente
npm run check:dead-hosts       # referencias a hosts muertos (Railway/Supabase/dominio nunca registrado)
npm run check:prisma-schema    # invariante: un único schema.prisma (api/prisma)
```

**Swagger de la API local**: `http://localhost:<PORT>/docs`.

---

## 5. Trampas conocidas (leídas caras en producción) 🪤

Estas reglas existen porque cada una rompió un build o producción real:

1. **Nada de `process.env?.X` en código cliente** — el _optional chaining_ anula el inlining de Next y envía `process` crudo al navegador → `process is not defined` en toda la app. Solo `process.env.X` plano con prefijo `NEXT_PUBLIC_` (o `NODE_ENV`). CI lo bloquea (`check:client-bundle`).
2. **Declara en el `package.json` de tu paquete todo lo que importas** — aunque npm lo hoistee y funcione local, el build de Vercel falla. Mantén además versiones alineadas de `lucide-react` y `@types/react` entre apps.
3. **El esquema canónico es `api/prisma/schema.prisma`** — es el único; no crees copias del schema en otros paquetes (la copia de `packages/db` se eliminó por haber derivado).
4. **No edites `apps/driver/public/sw.js`** — es un artefacto regenerado por next-pwa.
5. **Nada de hosts muertos** (Railway, Supabase, el dominio propio nunca registrado) en código, docs o `.env.example` — hay CI que lo bloquea. Las direcciones `@` en seeds/tests están bien (el check excluye emails).
6. **`useSearchParams()` exige un límite `<Suspense>`** en Next App Router (rompe el prerender si falta).
7. **Lint NO corre durante `next build`** en los tres apps — corre `npm run lint` antes de pushear.
8. **El gateway de sockets es null-safe** — puede invocarse desde flujos REST sin ningún cliente conectado; no le agregues suposiciones de conexión.

---

## 6. CI — qué corre en cada push

| Job                      | Qué hace                                                                         |
| ------------------------ | -------------------------------------------------------------------------------- |
| Repo Hygiene             | Hosts muertos + invariante de un único schema Prisma (~10s)                      |
| Client Bundle Safety     | Builda los 3 apps y escanea los bundles por `process`/`import.meta.env` crudos   |
| Test & Build             | `npm ci` → `prisma generate` → 53 tests → `nest build`                           |
| E2E Flow (real Postgres) | Postgres efímero → migrate → seed → boot de la API → 31 pasos del flujo completo |

Los tres jobs con dependencias comparten caché de npm + `node_modules` (action `.github/actions/setup-deps`); si tocas `package-lock.json`, la primera corrida reinstala desde cero.

**Para pasar CI a la primera** antes de pushear:

```bash
npm run lint && npm run type-check && npm run check:dead-hosts \
  && npm run check:client-bundle:build && cd api && npm test
```

---

## 7. Convenciones de commits y PRs

- Sujeto corto en inglés, estilo `Add ...` / `Fix ...` / `Remove ...` — dice el _por qué_ cuando cabe.
- El hook `pre-commit` (husky + lint-staged) aplica Prettier a lo que commiteas — no pelear con el formato.
- No commitees `.env`, llaves ni secretos; los ejemplos van en `*.env.example`.
- Un PR = un cambio lógico; si tocas `packages/ui`, menciona qué apps se ven afectadas (las tres lo consumen).
