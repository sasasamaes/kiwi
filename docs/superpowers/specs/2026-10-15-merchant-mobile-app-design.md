# Kiwi Negocios — App móvil nativa (Expo) — Design

- Date: 2026-10-15
- Status: approved by owner, pending spec review
- Context: tercera de tres apps móviles nativas (Repartidores → Clientes → **Negocios**).
  Este spec cubre **solo la app de Negocios v1**. Reusa `packages/mobile-ui` y
  `packages/mobile-core` (creados con Repartidores/Clientes) y `@kiwi/types` / `@kiwi/i18n`.
- Sources: `docs/PRD.md` (ME-01..ME-10), `docs/DESIGN.md`, `apps/web` (dashboard comercio,
  referencia funcional), `apps/driver-mobile` (patrón de app), API NestJS.

## 1. Goal

Dar al comerciante una app nativa **iOS + Android** centrada en la **operación en vivo**:
recibir pedidos con alertas confiables (pantalla fija + push), verlos como **comandas**,
avanzar estados con **foto de retiro**, y **solicitar/elegir repartidor** por calidad.

## 2. Non-goals (v1)

- No menú CRUD, ni analytics, ni generación de QR, ni alertas de tráfico, ni ads, ni
  créditos, ni onboarding KYC (todo eso queda en `apps/web`).
- No es la app de Clientes ni de Repartidores.
- No se reescribe el backend salvo lo mínimo.

## 3. Decisions (cerradas con el owner)

| Tema        | Decisión                                                               |
| ----------- | ---------------------------------------------------------------------- |
| Stack       | **Expo (React Native + TypeScript)**                                   |
| Plataformas | **iOS + Android desde el día 0**                                       |
| Alcance v1  | **Núcleo operativo** (operación en vivo)                               |
| Estructura  | `apps/merchant-mobile` + reuso de `packages/mobile-ui` / `mobile-core` |
| Estilos     | **NativeWind** (tokens de `docs/DESIGN.md`)                            |
| Alertas     | **Doble modo**: KDS siempre encendido **+** push/sonido en background  |
| Push        | **FCM actual** vía `PUT /notifications/device-token`                   |
| Offline     | **Caché básica + reconexión** (no offline-first)                       |

## 4. Verified constraints (research)

- Guard global **default-deny**; la app es autenticada como `merchant`.
- **Recepción en vivo**: socket room `user:{merchantId}`; eventos `order:create`,
  `order:statusUpdate` (mismo gateway que usan las otras apps).
- **Foto de retiro (pickup) la sube el COMERCIO** (`POST /orders/:id/proof-photo`,
  multipart `kind=pickup`); sin ella el driver no puede avanzar a `picked_up`. → la app
  necesita **cámara/galería** (expo-image-picker).
- **Avance de estados**: `PUT /orders/:id/status`; el comercio es dueño de la transición
  a preparado/retiro; el pedido se asigna vía repartidor.
- **Repartidor**: broadcast a disponibles (`GET /drivers/...` disponibles) o **favoritos**
  (`FavoriteDriver`); asignación (`POST /orders/:id/assign`) y aceptación del driver.
  Propuestas de programados: `POST /orders/:id/proposals` (driver) →
  `PUT /orders/:orderId/proposals/:proposalId/accept` (merchant).
- **Push iOS** requiere **APNs** en Firebase (Apple Developer + key); Android ya usa FCM.
- Pantalla fija (KDS) requiere mantener la sesión viva: keep-awake + socket; y alertas
  fuertes (sonido). Prerequisitos de runtime: **dev build + dispositivos reales**.

## 5. Architecture & repo structure

```
apps/
  merchant-mobile/      # Expo Router + TS + NativeWind  (este spec)
packages/
  mobile-ui/ mobile-core/   # reuso
```

- **Navegación:** Expo Router, grupos `(auth)` y `(app)`.
- **Estado servidor:** TanStack Query (respaldo del socket). **Estado app:** Zustand (sesión).
- **API client RN:** sobre `@kiwi/mobile-core` `createHttp` + `expo-secure-store`
  (token merchant; refresh en 401).
- **Diseño:** tokens de `packages/mobile-ui`. Tema claro/oscuro (KDS cómodo de día).
- **Builds:** EAS (`development`/`preview`/`production`), dev client iOS+Android.

## 6. Features (v1)

1. **Auth**: login merchant, sesión persistente, logout, perfil mínimo (nombre del negocio/teléfono).
2. **Recepción en vivo**: lista/tablero que se actualiza por socket; badge + sonido;
   push con deep link al pedido cuando está en background.
3. **Comandas / KDS**: tablero de pedidos activos con ítems, notas/variantes, tipo
   (delivery/pickup), dirección/origen, tiempos; columnas por estado (nuevo / en preparación / listo).
4. **Estados + foto de retiro**: aceptar → preparar → **subir foto de pickup** → listo;
   (el cierre de entrega lo hace el driver). Reintento si sube mal.
5. **Solicitar repartidor**: broadcast a disponibles o favoritos.
6. **Elegir repartidor**: ver nivel/calificación/vehículo; asignar; ver propuestas de programados y aceptar.
7. **Centro de notificaciones** básico (derivado de eventos).
8. **Modo KDS**: pantalla siempre encendida (keep-awake) mientras el tablero está activo.

## 7. Realtime & alerts design

- **Socket**: room `user:{merchantId}`; al entrar a `(app)` conectar; handlers actualizan
  la lista/comandas + suenan. Reconexión automática.
- **Push (background/closed)**: registrar token nativo (FCM/APNs) en
  `PUT /notifications/device-token` (platform ios/android). Notificaciones **high-priority**
  con sonido; canal Android con sonido dedicado; iOS con `sound` y `content-available`.
  Tap → deep link a `/order/[id]`.
- **KDS**: `expo-keep-awake` mientras la pantalla de comandas está montada; sonido local
  fuerte al recibir `order:create`.
- **Respaldo**: refetch por TanStack Query si el socket cae.

## 8. Errors & edges

- Socket caído: la lista se refresca por polling/query; banner "reconectando".
- Push no configurado (iOS sin APNs): los pedidos en foreground siguen por socket; se documenta.
- Foto de retiro: validar tamaño/tipo en cliente; reintentar; el server (magic-bytes/5MB) manda.
- Pedido cancelado por el cliente/comercio: sale del tablero con aviso.
- Repartidor no disponible: estado `no_driver` con opciones de reintentar/cancelar (ya existe en la web).
- Token expirado: refresh; si falla, logout limpio.

## 9. Testing / Definition of Done (v1)

- **Jest (puro):** máquina de columnas de comanda (estado → columna), ordenamiento por
  antigüedad, mapa de eventos socket → actualización de lista, payload de push.
- **RNTL:** comanda/tarjeta, tabla de comandas con datos mock.
- **CI:** `apps/merchant-mobile` + paquetes móviles → lint + `tsc` + tests.
- **Manual en dispositivo real (iOS + Android):** login → un pedido de prueba entra con
  **push + sonido** (background) y como **comanda** (foreground) → subir **foto de retiro**
  → avanzar estados → solicitar y asignar repartidor. KDS en tablet keeps awake.

## 10. Prerequisites (externos, no código)

- Cuenta **Apple Developer** + **key APNs** en Firebase (push iOS) + cuenta **EAS**.
- Dispositivos reales iPhone + Android (push) y una tablet para el KDS (opcional).

## 11. Rollout

1. Dev client Android + iOS; flujo completo en dispositivo.
2. Beta interna (TestFlight + Internal Testing) con 1–2 comercios piloto.
3. Piloto; coexistencia con el dashboard web.

## 12. Roadmap (post-v1)

- v2: menú CRUD, analytics, QR, alertas de tráfico, créditos/ads desde la app.
- Con esto quedan las 3 apps móviles nativas (Repartidores, Clientes, Negocios).

## 13. Open questions

- ¿El KDS necesita impresión térmica de comandas? (v2)
- ¿Multi-usuario por comercio (varios dispositivos) o una sesión por local? (v2)
