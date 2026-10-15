# Kiwi Clientes — App móvil nativa (Expo) — Design

- Date: 2026-10-15
- Status: approved by owner, pending spec review
- Context: segunda de tres apps móviles nativas (Repartidores → **Clientes** → Negocios).
  Este spec cubre **solo la app de Clientes v1**. Reusa `packages/mobile-ui` (creado con
  Repartidores) y `@kiwi/types` / `@kiwi/i18n`.
- Sources: `docs/PRD.md` (CL-01..CL-08), `docs/DESIGN.md`, `apps/client` (menú QR web,
  referencia funcional), `packages/ui/src/TrackingMap.tsx` (Leaflet → se reemplaza por
  MapLibre en nativo), API NestJS.

## 1. Goal

Dar a los clientes una app nativa **iOS + Android** para pedir en los comercios de Kiwi
de punta a punta: escanear el QR o abrir el menú, armar el carrito, pagar (SINPE/tarjeta,
efectivo o crypto), seguir el pedido en vivo con mapa y calificar — con **guest sin
registro** y **offline-first**.

## 2. Non-goals (v1)

- No es la app de Negocios ni de Repartidores (cada una su ciclo).
- No se reescribe el backend salvo lo mínimo (ver §5).
- No reemplaza la PWA `apps/client` en este ciclo (coexisten durante el piloto).

## 3. Decisions (cerradas con el owner)

| Tema         | Decisión                                                                   |
| ------------ | -------------------------------------------------------------------------- |
| Stack        | **Expo (React Native + TypeScript)**                                       |
| Plataformas  | **iOS + Android desde el día 0**                                           |
| Alcance v1   | **Paridad total** con la web (CL-01..CL-08 + seguir comercios)             |
| Estructura   | `apps/client-mobile` + reuso de `packages/mobile-ui`                       |
| Estilos      | **NativeWind** (tokens de `docs/DESIGN.md`)                                |
| Pagos hosted | **Navegador in-app** (`expo-web-browser`) + deep link de retorno + polling |
| Mapa         | **MapLibre GL** + tiles OSM (sin API key)                                  |
| Offline      | **Offline-first** (cola persistente; pagos se reanudan al volver online)   |
| Push         | **FCM actual** vía `PUT /notifications/device-token`                       |
| Auth         | **Guest por defecto**; login opcional (dirección/historial/seguir)         |

## 4. Verified constraints (research)

- Guard global **default-deny**; existen endpoints **guest** y públicos:
  `POST /orders` guest (con `idempotency-key`), `POST /payments` guest, menú público
  (`/menu/merchant/:id`, `/menu/merchant/:id/items`), `GET /geocoding/*` (**ya es público**
  tras el fix reciente, así que el autocompletado de direcciones funciona sin token).
- **OnvoPay** es **hosted checkout**: devuelve `checkoutUrl`; el estado final lo confirma
  el **webhook** del backend. En nativo se abre esa URL y se hace **polling** del estado.
- **Crypto (Stellar)**: el cliente paga a una wallet; el backend **verifica on-chain**.
- **Idempotencia**: el backend deduplica por `merchantId + idempotencyKey`; reusar la key
  para un pedido nuevo devuelve el anterior → la app debe **generar una key nueva por
  pedido** y reusarla solo al reintentar el **mismo** pedido.
- **Mapa**: la web usa Leaflet (no corre en RN) → MapLibre GL + tiles OSM (sin key).
- Push iOS requiere **APNs** en Firebase (cuenta Apple Developer + key).
- Prerequisitos de runtime igual que Repartidores: **dev build + dispositivos reales**
  (cámara QR, push, ubicación).

## 5. Architecture & repo structure

```
apps/
  client-mobile/        # Expo Router + TS + NativeWind  (este spec)
packages/
  mobile-ui/            # reuso (tema/componentes) — creado con Repartidores
```

- **Navegación:** Expo Router, grupos `(public)` (menú/menú QR/tracking por link) y
  `(account)` (perfil/historial/seguir). Guest accede a todo el flujo de pedido.
- **Estado servidor:** TanStack Query; **estado de app:** Zustand (carrito, sesión, modalidad).
- **API client RN:** fetch + adapter de token con **expo-secure-store** (token **opcional**:
  guest no tiene). Reusa el patrón de `apps/driver-mobile/src/api` (http con refresh).
- **Diseño:** tokens desde `packages/mobile-ui`.
- **Builds:** EAS (`development`/`preview`/`production`), dev client iOS+Android.

## 6. Features (v1)

1. **Descubrir:** home con comercios (cerca de mí / categorías), **escanear QR**
   (`expo-camera` barcode) → menú del comercio.
2. **Menú:** categorías, precios ₡, popularidad, stock y **preventa (mañana)**; variantes
   y grupos de opciones (incl. "Crea tu Bowl").
3. **Carrito:** cantidades, notas por ítem, variantes; persistido local.
4. **Checkout:** modalidad **pickup** (sin costo) o **envío** (costo por zona); dirección con
   autocompletado (geocoding público) o "mi ubicación"; datos de contacto; inmediato o
   **programado** (fecha + hora); método de pago.
5. **Pagos:** SINPE/tarjeta (OnvoPay hosted en navegador in-app + polling), efectivo,
   crypto (Stellar). Confirmación por webhook + polling.
6. **Tracking:** estado en vivo (socket/polling) + **mapa MapLibre** con pickup/entrega/
   repartidor y **ETA** del servidor.
7. **Historial + calificación**: ⭐ + flags de puntualidad/cuidado.
8. **Seguir comercio** (avisos de ventas/stock).
9. **Perfil**: direcciones, datos; **login/registro opcional**; push.
10. **Push:** cambios de estado del pedido.

## 7. Offline-first design

- **Cola persistente** (expo-sqlite) de operaciones: **crear pedido** (con `idempotencyKey`
  por pedido), datos de carrito/checkout; **efectivo** se completa offline.
- **Pagos electrónicos**: no se pueden cobrar sin red. Si hay un pedido creado con pago
  pendiente, al recuperar conexión la app **reanuda el checkout hosted** (abre el navegador
  in-app) y retoma el polling; hasta entonces queda marcado "pago pendiente".
- **Idempotencia**: una key por pedido nuevo; reuso solo al reintentar ese mismo pedido
  (evita el bug ya corregido en la PWA: no recalcular key en cada tap, no reusarla para otro pedido).
- **Caché**: menú del comercio y último estado del pedido para render offline.

## 8. Errors & edges

- Comercio cerrado / fuera de horario: bloquear "lo quiero ahora", permitir **preventa futura**.
- Stock agotado: el "+" se frena (el backend revalida atómico).
- Pago cancelado en el navegador: el pedido queda "pago pendiente" y se puede reintentar.
- SINPE/tarjeta no configurado en el comercio: método deshabilitado (flag del comercio).
- Sin GPS/permiso de ubicación: se puede escribir la dirección a mano.
- Cámara denegada: se puede abrir el menú por link/búsqueda en vez de QR.
- Deep link de retorno perdido: polling de estado igual resuelve.
- Token expirado / guest sin token: el http no adjunta auth y usa endpoints guest.

## 9. Testing / Definition of Done (v1)

- **Jest (puro):** carrito (total, variantes, notas), idempotencia (key por pedido), cola
  offline de creación de pedido, máquina de estados de tracking, parser del deep link de retorno.
- **RNTL:** pantallas clave (menú, carrito, checkout) con datos mock.
- **CI:** `apps/client-mobile` y `packages/mobile-ui` → lint + `tsc` + tests.
- **Manual en dispositivo real (iOS + Android):** escanear QR o abrir menú → pedir con
  **efectivo** y con **SINPE** (hosted + retorno) → tracking en vivo con mapa → calificar;
  con red caída a mitad, el pedido queda en cola y se envía al volver.

## 10. Prerequisites (externos, no código)

- Cuenta **Apple Developer** + **key APNs** en Firebase (push iOS) + cuenta **EAS**.
- Dispositivos reales iPhone + Android para QA (cámara, push).
- Comercio de prueba con OnvoPay y crypto configurados (para el flujo de pago real).

## 11. Rollout

1. Dev client Android + iOS; flujo completo en dispositivo (test mode de pagos).
2. Beta interna (TestFlight + Internal Testing) con clientes de prueba.
3. Piloto; coexistencia con la PWA `apps/client`.

## 12. Roadmap (post-v1)

- Extras: promociones/cupones, multi-comercio en un pedido, reseñas con foto.
- `apps/merchant-mobile` (Negocios) reusando `packages/mobile-ui`.

## 13. Open questions

- ¿La app reemplaza o complementa la PWA QR en el piloto? (operativo)
- ¿Wallet crypto embebida o deep link a wallet externa en v1? (el backend verifica on-chain igual)
