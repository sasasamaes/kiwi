# QA en dispositivo — Apps móviles Kiwi (Repartidores · Clientes · Negocios)

> Cómo validar en **dispositivos reales** lo que no se puede verificar headless:
> cámara/QR, pagos hosted, mapa, push, ubicación en segundo plano y KDS.

## 0. Prerequisitos (una vez)

- Cuenta **Apple Developer** + **key APNs** cargada en el proyecto **Firebase** (push iOS).
- Cuenta **EAS** (`npm i -g eas-cli && eas login`).
- `EXPO_PUBLIC_API_URL` apuntando al API (dev: `http://localhost:4100/api`; prod: `https://api.kiwicr.express/api`).
- Un **iPhone** y un **Android** físicos (push + cámara no funcionan en simulador).
- Opcional: una **tablet** para el KDS de Negocios.

## 1. Builds de desarrollo (dev client)

```bash
# desde cada app (driver-mobile / client-mobile / merchant-mobile)
npx expo prebuild            # MapLibre (client) y módulos nativos requieren prebuild
npx expo run:android         # o: eas build --profile development --platform android
npx expo run:ios             # o: eas build --profile development --platform ios
```

> ⚠️ **Expo Go no sirve** para push, BG location ni MapLibre. Usar **dev build**.
> ⚠️ No correr `npx expo install --fix`: sube `typescript` a v6 y rompe el type-check del monorepo.
> Nota monorepo: `react@19.2.3` (apps móviles) convive con `react@19.3.0` hoisteado por los frontends Next; `expo-doctor` lo marca como duplicado. EAS maneja workspaces; validar en el primer build.

## 2. Repartidores (`apps/driver-mobile`)

- [ ] Login `juan@kiwi.app` / `123456`; cierra y reabre: la sesión persiste.
- [ ] Toggle **online**: aparece "En línea"; con offline dice "Desconectado".
- [ ] Un comercio crea un pedido → entra a **Disponibles** (socket, sin recargar) y suena.
- [ ] **Aceptar** → pasa a "Pedido activo".
- [ ] Avanzar estados: `in_transit_to_pickup` → (tras la foto de retiro del comercio) `picked_up` → `in_transit_to_delivery` → subir **foto de entrega** (cámara) → `delivered`.
- [ ] **Push** con la app en background/cerrada al crearse un pedido.
- [ ] **Ubicación en segundo plano**: con la app minimizada y online, el comercio/cliente ve el movimiento.
- [ ] **Offline**: activar modo avión a mitad del flujo → la operación queda en cola → al volver la red se sincroniza.

## 3. Clientes (`apps/client-mobile`)

- [ ] **Escanear QR** de un comercio (expo-camera) → abre el menú correcto.
- [ ] Menú con categorías, precios ₡, preventa del día siguiente.
- [ ] Agregar items (y un producto con variantes tipo "Crea tu Bowl") → carrito con cantidades/notas.
- [ ] Checkout: **pickup** (sin costo) y **envío** (costo por zona); autocompletado de dirección (geocoding) y "mi ubicación"; programado (fecha+hora).
- [ ] **Efectivo** → crea pedido y muestra seguimiento.
- [ ] **SINPE/tarjeta** → abre el **navegador in-app** (OnvoPay), volver por deep link → polling confirma pago.
- [ ] **Crypto** (Stellar) → wallet + verificación on-chain.
- [ ] **Tracking** con **Mapa (MapLibre/OSM)** + ETA; el marcador del repartidor se mueve en vivo.
- [ ] **Historial** y **calificación** (⭐ + puntualidad/cuidado).
- [ ] **Seguir comercio** y recibir **push** de cambios de estado.
- [ ] **Offline**: pedido con red caída → queda en cola; con pago electrónico, al volver la red se **reanuda el checkout**.
- [ ] **Idempotencia**: hacer **dos pedidos seguidos** al mismo comercio → **dos números distintos** (regresión del fix de la PWA).

## 4. Negocios (`apps/merchant-mobile`)

- [ ] Login `luis@kiwi.app` / `123456`; perfil/logout.
- [ ] **Comandas (KDS)**: un pedido nuevo aparece en la columna "nuevo" **en vivo** (socket) y suena.
- [ ] Con la app en **background** llega **push/sonido** de pedido nuevo (verificar APNs/FCM).
- [ ] **Modo KDS**: con la pantalla de comandas activa, el teléfono **no se apaga** (keep-awake).
- [ ] Detalle del pedido: **subir foto de retiro** (cámara) → el driver ya puede avanzar a `picked_up`.
- [ ] **Solicitar/elegir repartidor**: ver **disponibles** y **favoritos** (nivel/rating/vehículo) y **asignar**.
- [ ] Pedido **programado**: ver **propuestas** de repartidores y aceptar.
- [ ] Centro de **notificaciones**.

## 5. Regresión de backend (esta ronda)

- [ ] Al crear un pedido, el **comercio** recibe el evento **`order:new`** por socket (su `user:{id}`) y un **push** "Nuevo pedido". Antes no llegaba (solo a drivers) → el KDS ahora es en vivo, no por polling.
- [ ] Las 3 apps reciben eventos por socket (`order:new` / `order:statusChanged`): antes escuchaban nombres inbound (`order:create`/`order:statusUpdate`) que nunca llegan.
- [ ] El detalle del pedido del comercio incluye **proposals** (ocultas a driver/cliente).

## 6. Comandos útiles

```bash
npm --workspace @kiwi/driver-mobile run type-check && npm --workspace @kiwi/driver-mobile run test
npm --workspace @kiwi/client-mobile run type-check && npm --workspace @kiwi/client-mobile run test
npm --workspace @kiwi/merchant-mobile run type-check && npm --workspace @kiwi/merchant-mobile run test
npm --workspace @kiwi/mobile-core run test
```
