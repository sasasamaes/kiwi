# Kiwi Repartidores — App móvil nativa (Expo) — Design

- Date: 2026-10-15
- Status: approved by owner, pending spec review
- Context: primera de tres apps móviles nativas (Repartidores → Clientes → Negocios).
  Este spec cubre **solo la app de Repartidores v1**; Clientes y Negocios tendrán su
  propio ciclo spec → plan → implementación y reusarán `packages/mobile-ui`.
- Sources: `docs/PRD.md` (DR-01..DR-13, DR-12 nativa Expo), `docs/DESIGN.md`
  (design system), `apps/driver` (PWA offline-first, referencia funcional),
  API NestJS (`api/`) y endpoints existentes.

## 1. Goal

Entregar una app **nativa iOS + Android desde el día 0** para repartidores que cubra
el **núcleo del turno** con calidad nativa: recibir pedidos (push + tiempo real),
aceptarlos, completar el ciclo de estados con evidencia de entrega, y **operar
offline-first** igual que la PWA. Es donde lo nativo aporta valor real
(notificaciones push, ubicación en segundo plano, cámara).

## 2. Non-goals (v1)

- No incluye: ganancias, retiros, horario semanal, perfil editable, KYC, propuestas
  de pedidos programados, analytics. (→ v2)
- No incluye evidencia de **retiro** (la sube el comercio desde el panel web).
- No hay app nativa de Clientes ni de Negocios en este ciclo.
- No se reescribe el backend salvo lo mínimo (ver §5). No se toca la PWA `apps/driver`.

## 3. Decisions (cerradas con el owner)

| Tema               | Decisión                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| Stack              | **Expo (React Native + TypeScript)**                                    |
| Plataformas        | **iOS + Android a la par desde el día 0**                               |
| Orden de productos | **Repartidores primero**, luego Clientes y Negocios                     |
| Alcance v1         | **MVP núcleo del turno** (no paridad total)                             |
| Estructura         | **Un workspace por app** + paquete compartido `packages/mobile-ui`      |
| Estilos            | **NativeWind** (Tailwind RN, tokens de `docs/DESIGN.md`)                |
| Offline            | **Offline-first desde el día 1** (cola persistente + sync)              |
| Push               | **Reusar FCM actual** vía el endpoint `PUT /notifications/device-token` |
| Build/prueba       | **EAS Build + dev client** (Expo Go no soporta BG location/push)        |

## 4. Verified constraints (research)

- El guard global del API es **default-deny** (`@Public()` para lo anónimo); la app es
  autenticada como `driver`.
- El ciclo de estados **exige evidencia**:
  - `picked_up` requiere la **foto de retiro** que sube el **comercio** (no el driver).
  - `delivered` requiere la **foto de entrega** que sube el **driver**.
    Por eso v1 necesita **cámara**, pero solo para la foto de entrega.
- Endpoints reutilizables ya existentes: `POST /auth/login|refresh`, `GET /orders/available`,
  `POST /orders/:id/accept|reject`, `PUT /orders/:id/status`,
  `POST /orders/:id/proof-photo` (multipart `kind=delivery`), `GET /orders/my`,
  `PUT /notifications/device-token` (`platform: ios|android`), socket room `role:driver`
  (eventos `order:*`, `driver:locationUpdate`).
- El backend ya envía por **FCM** (`firebase-admin`). **Push en iOS requiere APNs**
  configurado en el proyecto Firebase (cuenta Apple Developer + key APNs).
- `expo-notifications` `getDevicePushTokenAsync()` devuelve token **FCM (Android)** /
  **APNs (iOS)** → se registra en el endpoint existente sin cambios de backend.
- Ubicación en segundo plano y push **requieren dispositivo real** (no simulador/emulador
  para QA en serio).
- El `api-client` de `packages/ui` asume APIs de navegador (localStorage). En RN se usa
  un cliente fetch propio con **expo-secure-store** para el token (ver §5).

## 5. Architecture & repo structure

```
apps/
  driver-mobile/        # Expo Router + TS + NativeWind  (este spec)
  client-mobile/        # futuro
  merchant-mobile/      # futuro
packages/
  mobile-ui/            # tema/tokens (DESIGN.md), componentes RN, config NativeWind
  types/ i18n/          # reuso existente (@kiwi/types, @kiwi/i18n)
```

- **Navegación:** Expo Router (file-based), grupos `(auth)` / `(app)`.
- **Estado servidor:** TanStack Query (caché, refetch, retry). **Estado de app:** Zustand
  o Context para sesión/turno.
- **API client RN:** `apps/driver-mobile/src/api` — fetch tipado reusando tipos de
  `@kiwi/types`; adapter de token con **expo-secure-store** (access + refresh);
  interceptor de 401 → refresh automático.
- **Tiempo real:** `socket.io-client` autenticado, join `role:driver`.
- **Diseño:** tokens (color/tipografía/spacing) en `packages/mobile-ui` derivados de
  `docs/DESIGN.md`; `dark` por defecto (Midnight Canvas) con variante clara.
- **Builds:** EAS (`development` dev-client + `preview` + `production`) para iOS y Android.

## 6. Features (v1)

1. **Auth:** login (email+password) rol `driver`; sesión persistente (SecureStore);
   logout; refresh silencioso.
2. **Turno:** toggle online/offline; refleja estado al backend; gatea feed y ubicación.
3. **Disponibles:** lista en vivo de `GET /orders/available` + socket; aceptar / rechazar.
4. **Pedido activo:** detalle con origen/destino, distancia, ganancia, contacto;
   transiciones de estado válidas; captura y subida de **foto de entrega** (cámara);
   estado explícito "esperando foto de retiro del comercio" cuando el backend lo exige.
5. **Push:** nuevos pedidos, "otro lo tomó", cambios de estado; tap abre el pedido.
6. **Ubicación en segundo plano:** mientras online, updates throttled/batched.
7. **Perfil mínimo:** datos del repartidor + logout.

## 7. Offline / data design

- **Cola persistente** en `expo-sqlite`: operaciones encolables = `accept`, `reject`,
  `statusUpdate` (+ `deliveryProof` como upload multipart diferido).
- **Replay FIFO** al reconectar (NetInfo); idempotencia: `accept` ya es idempotente por
  driver; `statusUpdate` es determinista.
- **Conflictos:** el servidor manda. Si una transición ya no es válida (400), se descarta
  y se avisa al usuario ("este pedido cambió").
- **Caché mínima:** pedido activo + disponibles para renderizar offline.

## 8. Errors & edges

- Sin GPS / permiso denegado: la app opera igual; ubicación degradada (banner).
- Sin conexión al aceptar: entra a la cola y se confirma optimista; reconciliación al volver.
- Cámara denegada: bloquea solo `delivered` (con guía a ajustes).
- Token expirado / revocado: refresh; si falla, logout limpio.
- Pedido cancelado por el comercio estando en curso: sale del activo con aviso.
- Push iOS sin APNs configurado: los eventos en vivo (socket) siguen; se documenta el prerequisito.

## 9. Testing / Definition of Done (v1)

- **Jest:** lógica de cola offline (FIFO, idempotencia, conflicto), transformaciones de
  estado, reducer de turno.
- **RNTL:** pantallas clave (login, disponibles, pedido activo) con datos mock.
- **CI:** lint + `tsc --noEmit` en `driver-mobile` y `mobile-ui`.
- **Manual en dispositivo real (iOS + Android):** login → online → recibir (push + vivo)
  → aceptar → completar ciclo con foto de entrega, **incluyendo una pérdida de señal a
  mitad** (la cola se recupera sin perder la operación).

## 10. Prerequisites (externos, no código)

- Cuenta **Apple Developer** + **key APNs** cargada en el proyecto Firebase (push iOS).
- Cuenta **EAS** (Expo) para builds iOS/Android.
- Un **iPhone** y un **Android** físicos para QA (push + BG location).
- FCM ya configurado para Android (existente).

## 11. Rollout

1. Dev client en Android + iOS; flujo completo en dispositivo (test mode).
2. APNs + EAS production; beta interna (TestFlight + Internal Testing) con 1–2 repartidores.
3. Piloto con flota chica; luego reemplazo gradual de la PWA por la app nativa.

## 12. Roadmap (post-v1)

- v2 Repartidores: ganancias, retiros, horario, perfil editable, KYC, propuestas programadas.
- `apps/client-mobile` y `apps/merchant-mobile` reusando `packages/mobile-ui` + `@kiwi/types`/`i18n`.

## 13. Open questions

- ¿Editor de perfil/KYC mínimo ya en v2 o más adelante? (no bloquea v1)
- ¿Se mantiene la PWA `apps/driver` en paralelo durante el piloto, o se deprecia gradual? (operativo)
