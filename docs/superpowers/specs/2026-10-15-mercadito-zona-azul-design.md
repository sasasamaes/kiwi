# Mercadito Zona Azul — Design

- Date: 2026-10-15
- Status: approved by owner, pending spec review
- Context: sección nueva en el menú cliente (`apps/client` → www.kiwicr.express) +
  alta de productos en un comercio existente (cuenta `sasasamaes13@gmail.com`).
- Sources: `apps/client` (home + `/menu/[id]`), API NestJS (`/menu/*`, `/merchants/discover`),
  `packages/ui/src/api-client.ts`.

## 1. Goal

Dar visibilidad y compra a productos artesanales locales de la Zona Azul de Nicoya
(empezando por **cuajada con leche**), mediante una sección propia **"Mercadito Zona Azul"**
en el cliente y el alta del producto en el perfil de comercio del dueño.

## 2. Non-goals

- No es un marketplace multi-comercio: la sección muestra los productos del comercio del
  dueño (config por id).
- No incluye pago/gestión del inventario propio (compra de 60 a la proveedora) ni imágenes
  reales (queda emoji/placeholder por ahora).

## 3. Decisions (cerradas con el owner)

| Tema          | Decisión                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Alcance       | Sección nueva en el cliente **+** productos en el perfil del comercio                            |
| Precio        | El **ítem es el par**: "Par (2 unidades)" a **₡2000** (mínimo 2)                                 |
| Stock         | **60** unidades (los que comprará el dueño)                                                      |
| Alta de datos | **Script reproducible** (`scripts/seed-mercadito-zona-azul.mjs`) que corre el dueño con su login |

## 4. Datos

Comercio: `sasasamaes13@gmail.com` (ya registrado; el script valida que tenga perfil de
comercio vía `GET /merchants/me` y corta con mensaje claro si no).

Item a crear (`POST /menu/my`):

- `name`: "Cuajada con leche de Nicoya — Par (2 unidades)"
- `price`: 2000
- `category`: "Mercadito Zona Azul"
- `stockQty`: 60
- `isAvailable`: true
- `description`: artesanal, de productoras de Nicoya, Zona Azul; "2 unidades por ₡2000".
- `image`: emoji placeholder (🧀 o 🥛) hasta tener foto real.

Deja comentado el item de **tortillas de maíz de la zona** para cuando el dueño hable con
la proveedora.

## 5. Sección en el cliente

- Ruta nueva **`/zona-azul`** (`apps/client/app/zona-azul/page.tsx`):
  - Encabezado con el nombre del comercio (perfil público).
  - Lista de productos de la categoría **"Mercadito Zona Azul"** (nombre, precio, descripción,
    nota "Par · 2 unidades"). El comercio se resuelve con
    **`NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID`** (id que imprime el script).
  - CTA **"Ver menú completo y pedir"** → `/menu/{merchantId}` (usa el checkout existente).
  - Bloque de **descripción Blue Zone**.
  - Si la env no está seteada: estado "Próximamente".
- **Acceso en el home**: una tarjeta/entrada destacada "Mercadito Zona Azul 🥝" en
  `apps/client/app/page.tsx` que lleva a `/zona-azul`.

## 6. Copy — descripción Blue Zone

> Nicoya es una de las 5 Zonas Azules del mundo: aquí la gente vive más y mejor, en gran
> parte por su alimentación. El **Mercadito Zona Azul** de Kiwi reúne productos artesanales
> y locales —cuajada con leche, maíz de la zona— directo de manos de productores de Nicoya.
> Comprá local, comé como en la Zona Azul. 🥥

## 7. Errores y bordes

- Env `NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID` ausente → sección "Próximamente" (no rompe el home).
- Comercio sin la categoría aún → la sección muestra el copy Blue Zone + "en preparación".
- El script es **idempotente-básico**: si ya existe un item con el mismo nombre en la
  categoría, lo actualiza en vez de duplicarlo (busca en `GET /menu/my`).

## 8. Testing / DoD

- **API/script**: correr el script contra un API local (dev) con un comercio de prueba →
  crea el item; re-ejecutar → no duplica.
- **Cliente**: `tsc` limpio; `/zona-azul` compila y renderiza (build de Next). Con la env
  seteada, muestra los productos; sin la env, "Próximamente".
- **Manual**: entrar a `www.kiwicr.express` → ver el acceso → abrir `/zona-azul` → "Ver menú
  y pedir" → agregar el par al carrito → el total da ₡2000.

## 9. Rollout

1. Correr el script (el dueño) contra prod → crea el item.
2. Setear `NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID` en Vercel (apps/client) con el id impreso.
3. Deploy del cliente.

### Runbook (comandos exactos)

```bash
# 1) Alta de productos (imprime el merchantId)
API_URL=https://api.kiwicr.express/api \
E2E_MERCHANT_EMAIL=sasasamaes13@gmail.com E2E_PASSWORD='<tu-clave>' \
node scripts/seed-mercadito-zona-azul.mjs

# 2) En Vercel → proyecto del cliente (kiwi-client) → Settings → Environment Variables:
#    NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID = <merchantId impreso>

# 3) Deploy
cd apps/client && vercel --prod
```

> Sin la env `NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID`, `/zona-azul` muestra "Próximamente"
> y el home no rompe.
