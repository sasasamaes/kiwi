# 📋 PRD — Kiwi 🥝

### Product Requirements Document — Plataforma de delivery para Nicoya, Costa Rica

| Campo                       | Valor                                                               |
| --------------------------- | ------------------------------------------------------------------- |
| **Producto**                | Kiwi — ecosistema de delivery (comercios + repartidores + clientes) |
| **Versión del documento**   | 1.0                                                                 |
| **Fecha**                   | 2026-09-07                                                          |
| **Estado**                  | En desarrollo activo (MVP funcional en progreso)                    |
| **Mercado inicial**         | Nicoya, Guanacaste, Costa Rica                                      |
| **Documentos relacionados** | `README.md`, `ECOSYSTEM.md`, `docs/DESIGN.md`, `DEPLOYMENT.md`      |

---

## 1. Resumen ejecutivo

Kiwi es una plataforma que conecta **comercios locales**, **repartidores independientes** y **clientes** en Nicoya. El cliente escanea un QR en el local, pide y paga desde su teléfono; el comercio recibe el pedido en tiempo real y puede solicitar un repartidor on-demand cuando necesita envío; el repartidor acepta pedidos, entrega y cobra su comisión.

El producto se compone de 4 superficies sobre un backend único:

1. **Menú QR del cliente** (`apps/client`) — pedir y pagar sin instalar nada.
2. **Dashboard del comercio** (`apps/web`) — gestionar menú, pedidos, repartidores y analíticas.
3. **App del repartidor** (`apps/driver` como PWA offline-first, `apps/mobile` como app nativa Expo).
4. **Panel de administración** (módulo `/admin` en `apps/web`).

> **Visión:** _"Comercios felices porque encuentran repartidores, repartidores felices porque encuentran trabajo y ganan dinero, y clientes felices porque piden fácil y rápido desde el QR."_

---

## 2. Problema y oportunidad

### Problema

- Los comercios de Nicoya no cuentan con repartidores propios ni con herramientas digitales de pedidos.
- Las plataformas internacionales de delivery tienen alta comisión, poca presencia local y no se adaptan a los métodos de pago costarricenses (SINPE Móvil, efectivo).
- Los repartidores independientes no tienen una fuente constante ni confiable de trabajo.

### Oportunidad

- Ecosistema local con comisiones justas (fee bajo de plataforma), pagos 100% locales + crypto, y selección de repartidores **por calidad, no por precio**.
- Modelo de red: más comercios → más clientes → más repartidores → mejor servicio (ciclo virtuoso).

---

## 3. Objetivos del producto

| #   | Objetivo                                                     | Métrica principal                                |
| --- | ------------------------------------------------------------ | ------------------------------------------------ |
| O1  | Digitalizar el pedido y pago de comercios locales vía QR     | % de comercios con menú QR activo                |
| O2  | Dar a repartidores trabajo flexible con ingresos predecibles | Pedidos/día por repartidor activo                |
| O3  | Entrega rápida y confiable                                   | Tiempo promedio de entrega; calificación ≥ 4.5   |
| O4  | Soportar los métodos de pago del mercado local               | % de pedidos pagados digitalmente                |
| O5  | Operar en zonas con conectividad intermitente                | Pedidos completados offline sin pérdida de datos |

### No-objetivos (para esta fase)

- ❌ App nativa de cliente (el menú QR es web, sin instalación).
- ❌ Expansión fuera de Guanacaste (Fase 4).
- ❌ Marketplace de productos (no-groceries a escala) — el foco es pedidos de menú + envío.

---

## 4. Usuarios y personas

### 👤 Cliente (sin cuenta obligatoria)

Escanea el QR del local. Quiere: pedir rápido, pagar como acostumbra (SINPE/tarjeta/efectivo/crypto), elegir recoger o envío, y seguir su pedido en tiempo real.

### 🏪 Comercio

Dueño o encargado de un local (ej. "Bowl & Café Luis Alfredo"). Quiere: recibir pedidos sin filas, menú digital profesional, repartidores on-demand sin contratar, y datos de venta.

### 🛵 Repartidor

Trabajador independiente con moto, bici, carro o camión. Quiere: flexibilidad total de horario, ver la ganancia antes de aceptar (₡), cobrar rápido (SINPE/transferencia) e ir subiendo de nivel (bronce → VIP).

### 🛡️ Administrador Kiwi

Opera la plataforma: aprueba KYC, gestiona usuarios, pagos, retiros, alertas de tráfico y parámetros del sistema.

---

## 5. Alcance por superficie

### 5.1 Menú QR — Cliente (`apps/client`, Next.js, puerto 3002)

> Rutas existentes: `/`, `/menu/[id]`, `/order/checkout`, `/order/[id]/tracking`, `/tracking/[id]`, `/orders`

| ID    | Requisito                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------- |
| CL-01 | Escanear código QR del comercio (html5-qrcode) y abrir su menú sin registrarse                       |
| CL-02 | Ver menú por categorías, con precios (₡), popularidad y disponibilidad                               |
| CL-03 | Carrito: agregar/quitar ítems con cantidad y notas por ítem                                          |
| CL-04 | Elegir modalidad: **Recoger en local** (sin costo) o **Envío a dirección** (costo de envío dinámico) |
| CL-05 | Checkout con métodos: **SINPE, tarjeta (OnvoPay), efectivo, crypto (Stellar)**                       |
| CL-06 | Pedidos **inmediatos o programados** (fecha + hora específica)                                       |
| CL-07 | Tracking en tiempo real del estado del pedido                                                        |
| CL-08 | Historial de pedidos y calificación (⭐ + flags de puntualidad/cuidado)                              |

### 5.2 Dashboard del Comercio (`apps/web`, Next.js 15, puerto 3000)

> Rutas existentes: `/dashboard`, `/menu`, `/orders/new`, `/orders/scheduled`, `/merchants/[id]/qr`, `/drivers`, `/analytics`, `/analytics/traffic`, `/merchant/traffic-settings`, `/notifications`, `/kyc`, `/register`, `/login`

| ID    | Requisito                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------ |
| ME-01 | Registro y login (JWT); onboarding con KYC de negocio (licencia, cédula tributaria)                          |
| ME-02 | Gestión de menú: CRUD de ítems con imagen, categoría, precio, popularidad y disponibilidad                   |
| ME-03 | Generación e impresión del **QR por comercio** (`/merchants/[id]/qr`)                                        |
| ME-04 | Recepción de pedidos en tiempo real (Socket.io + notificaciones FCM) con detalles e instrucciones especiales |
| ME-05 | Gestión de pedidos inmediatos y programados; avance de estados                                               |
| ME-06 | **Solicitud de repartidor**: broadcast a repartidores disponibles o a favoritos (`FavoriteDriver`)           |
| ME-07 | Selección de repartidor por calidad: ver nivel, calificación, vehículo y propuestas                          |
| ME-08 | Analytics: ventas, ítems más vendidos, horas pico                                                            |
| ME-09 | **Alertas de tráfico** configurables por zona (`traffic-settings`) que ajustan tiempos/costos de envío       |
| ME-10 | Centro de notificaciones                                                                                     |

### 5.3 App del Repartidor (`apps/driver` PWA, puerto 3001 + `apps/mobile` Expo nativa)

> Rutas PWA: `/landing`, `/register`, `/login`, `/kyc`, `/schedule`, `/active`, `/scheduled`, `/earnings`, `/withdraw`, `/analytics`, `/profile`

| ID    | Requisito                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| DR-01 | Registro con KYC completo: cédula (frente/reverso), selfie, licencia, registro vehicular y seguro                             |
| DR-02 | Perfil con **tipo de vehículo** (moto, bici bota, bici, carro, camión), placa y nivel (bronce → plata → oro → diamante → VIP) |
| DR-03 | Horarios semanales (`DriverSchedule`) y modo **online/offline/ocupado**                                                       |
| DR-04 | Feed de pedidos con: origen, destino, distancia, **ganancia en ₡**; aceptar o rechazar                                        |
| DR-05 | Propuestas para pedidos **programados** (`DriverProposal`) con hora estimada de llegada                                       |
| DR-06 | Flujo de entrega guiado por estados: en camino a recoger → recogido → en camino a entregar → entregado                        |
| DR-07 | **Modo offline (PWA)**: operar sin internet y sincronizar al reconectar (next-pwa)                                            |
| DR-08 | Navegación al comercio y al cliente (Google Maps en nativa)                                                                   |
| DR-09 | Ganancias y retiros: acumulado, histórico, solicitud de retiro por **SINPE o transferencia bancaria**                         |
| DR-10 | **Incentivos físicos** por constancia y calificación: bolso, cubre-lluvia, caja, mantenimiento, marchamo                      |
| DR-11 | Analytics personales: viajes, calificación, progreso de nivel                                                                 |
| DR-12 | App nativa (Expo) con notificaciones push, geolocalización en segundo plano y socket en tiempo real                           |

### 5.4 Panel de Administración (módulo `/admin` de `apps/web`)

> Rutas existentes: `/admin`, `/admin/orders`, `/admin/payments`, `/admin/withdrawals`, `/admin/kyc`, `/admin/users`, `/admin/traffic-alerts`, `/admin/settings`

| ID    | Requisito                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------- |
| AD-01 | Dashboard operacional con métricas globales                                                                      |
| AD-02 | Gestión de pedidos: monitoreo y resolución de incidencias                                                        |
| AD-03 | Conciliación de pagos (OnvoPay + crypto + efectivo) y reembolsos                                                 |
| AD-04 | Aprobación/rechazo de **retiros** de repartidores con trazabilidad                                               |
| AD-05 | Revisión de **KYC** de comercios y repartidores (estados: pendiente → en revisión → aprobado/rechazado/expirado) |
| AD-06 | Gestión de usuarios: activar, desactivar, auditar                                                                |
| AD-07 | Emisión de **alertas de tráfico** zonales visibles para comercios y repartidores                                 |
| AD-08 | Configuración del sistema: comisiones, tarifas base, zonas                                                       |

---

## 6. Flujo del pedido (happy path)

```
Cliente escanea QR → arma carrito → paga (SINPE/tarjeta/crypto/efectivo)
  → Pedido creado (pending)
  → Comercio recibe notificación y prepara
  → Si es envío: solicitud de repartidor
      → Inmediato: broadcast a disponibles → repartidor acepta (assigned)
      → Programado: repartidores envían propuestas → comercio elige (driver_proposals → assigned)
  → en_transit_to_pickup → picked_up → in_transit_to_delivery → delivered
  → Cliente califica → Payouts: comercio, repartidor, fee Kiwi
```

**Estados del pedido** (`OrderStatus`): `pending → driver_proposals → assigned → in_transit_to_pickup → picked_up → in_transit_to_delivery → delivered | cancelled`

---

## 7. Pagos

| Método      | Proveedor   | Detalle                                                              |
| ----------- | ----------- | -------------------------------------------------------------------- |
| Tarjeta     | **OnvoPay** | Checkout hosted + webhooks (`onvopay_card`)                          |
| SINPE Móvil | **OnvoPay** | Cobro directo a teléfono costarricense (`onvopay_sinpe`)             |
| Crypto      | **Stellar** | Moneda, red, wallet y tx hash registrados; tipo de cambio en el pago |
| Efectivo    | —           | Registro manual, liquidación al comercio                             |

**Retiros de repartidores:** SINPE Móvil o transferencia bancaria, con aprobación de admin y trazabilidad completa (`Withdrawal`).

---

## 8. Modelo de negocio

Ejemplo de referencia (pedido ₡5,700 + envío ₡1,500 = ₡7,200):

| Parte         | Recibe | Comentario                                  |
| ------------- | ------ | ------------------------------------------- |
| 🏪 Comercio   | ₡5,700 | Valor íntegro de los productos              |
| 🛵 Repartidor | ₡1,200 | ~80% del costo de envío                     |
| 🥝 Kiwi       | ₡300   | ~20% del costo de envío (fee de plataforma) |

- Proyección (100 pedidos/día): Kiwi ≈ ₡900,000/mes; repartidores ≈ ₡3.6M/mes; comercios ≈ ₡17.1M/mes.
- **Selección por calidad, no por precio:** los repartidores no subastan el envío; el comercio elige por nivel y calificación.
- Incentivos no monetarios (equipo y mantenimiento) para retener repartidores.

---

## 9. Requisitos no funcionales

| Área              | Requisito                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Offline**       | La app del repartidor (PWA) debe funcionar sin conexión y sincronizar al reconectar; el menú QR debe cargar con red débil |
| **Tiempo real**   | Notificaciones de pedidos < 2s (Socket.io + FCM)                                                                          |
| **Seguridad**     | JWT + bcrypt; KYC obligatorio para comercios y repartidores; datos de documentos protegidos                               |
| **Dispositivos**  | Cliente y comercio: web responsive; repartidor: PWA instalable + app nativa iOS/Android (EAS)                             |
| **Monitoreo**     | Sentry en API y frontends; profiling en backend                                                                           |
| **Idioma/moneda** | Español, colones (CRC) como moneda base                                                                                   |
| **Escalabilidad** | Stateless API (Railway/AWS), Postgres gestionado (Supabase/Neon), Vercel para frontends                                   |

---

## 10. Arquitectura técnica (implementada)

```
kiwi/ (monorepo npm workspaces + Turborepo)
├── apps/
│   ├── web/      Next.js 15 + React 19 — Comercio + Admin   :3000
│   ├── driver/   Next.js 15 + next-pwa  — Repartidor PWA    :3001
│   ├── client/   Next.js 14 + html5-qrcode — Menú QR        :3002
│   └── mobile/   Expo + React Native (socket.io, maps, FCM) — Repartidor nativo
├── packages/     ui · db · types · config (compartidos)
└── api/          NestJS + Prisma + PostgreSQL
                  JWT auth · Socket.io · Firebase Admin (push) · Swagger · Sentry
```

**Modelo de datos (Prisma):** `User` (roles merchant/driver/admin), `MerchantProfile`, `DriverProfile` (niveles, vehículo, estatus), `KYCVerification`, `DriverSchedule`, `Order` + `OrderItem`, `DriverProposal`, `Payment`, `Rating`, `FavoriteDriver`, `DriverIncentive`, `Withdrawal`, `MenuItem`, `Notification`.

**Deploy:** Frontends en Vercel; API en Railway/AWS; DB en Supabase/Neon.

---

## 11. Roadmap

| Fase                       | Alcance                                                                 | Estado    |
| -------------------------- | ----------------------------------------------------------------------- | --------- |
| **1. Validación (Nicoya)** | 5–10 comercios piloto, 10–15 repartidores, zona centro                  | 🔄 Actual |
| **2. Crecimiento local**   | 20–30 comercios, 30–50 repartidores, más barrios, features por feedback | ⏳        |
| **3. Expansión regional**  | Liberia, Santa Cruz, Cañas; marketing                                   | ⏳        |
| **4. Nacional**            | Todo Guanacaste + Valle Central; app nativa completa                    | ⏳        |

---

## 12. Métricas de éxito

| Métrica                   | Mes 1 | Mes 3 | Mes 6 |
| ------------------------- | ----- | ----- | ----- |
| Comercios activos         | 10    | 30    | 100   |
| Repartidores activos      | 15    | 50    | 200   |
| Pedidos/día               | 20    | 100   | 500   |
| Retención de clientes     | 40%   | 60%   | 75%   |
| Retención de repartidores | 50%   | 70%   | 80%   |
| Calificación promedio     | 4.5   | 4.7   | 4.8   |

---

## 13. Riesgos y mitigaciones

| Riesgo                                            | Mitigación                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| Densidad inicial baja (pocos repartidores online) | Zona piloto concentrada; favoritos por comercio; incentivos físicos |
| Adopción de pago digital baja en zona rural       | Efectivo como opción de primera clase; SINPE nativo                 |
| Conectividad intermitente                         | Offline-first en repartidor; PWA en todas las superficies           |
| Fraude/KYC                                        | Verificación documental + selfie con revisión manual del admin      |
| Conciliación multi-método de pago                 | Estados de pago explícitos y panel de conciliación de admin         |

---

## 14. Gaps detectados (pendientes vs. este PRD)

1. **Fee y tarifas dinámicas** — el esquema tiene `basePrice`/`commission`/`driverPayout`, pero falta UI de admin (`/admin/settings`) conectada para parametrizar comisiones y tarifas por zona.
2. **Tracking del cliente** — la pantalla existe, pero hay que confirmar la actualización en vivo (socket) y el mapa.
3. **Pagos crypto** — modelo de datos listo (Stellar); falta confirmar el flujo completo de confirmación de tx.
4. **Calificación bidireccional** — `Rating` cubre cliente→repartidor/comercio; falta flujo repartidor→cliente si se desea.
5. **Apps nativas en stores** — configuración EAS lista; falta publicación y assets (ver `docs/APP_STORE_ASSETS.md`).
6. **Notificaciones de comercio** — centro de notificaciones existe; falta definir SLA de alertas de pedidos entrantes sin conexión.

---

_Documento generado a partir del código actual (`schema.prisma`, rutas de apps, `.env.example`) y de la visión en `ECOSYSTEM.md`. Última revisión: 2026-09-07._
