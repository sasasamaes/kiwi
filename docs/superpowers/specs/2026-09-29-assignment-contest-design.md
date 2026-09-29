# Asignación con timeout, reasignación y concurso — Design

Fecha: 2026-09-29 · Estado: aprobado por el dueño · Alcance: pedidos inmediatos

## Problema

Hoy asignar un pedido a un repartidor es definitivo e instantáneo: si el
driver no responde, el pedido queda colgado sin reasignación ni aviso. Se
necesita aceptación con timeout (5 min), concurso entre drivers (10 min) y
un estado final cuando nadie toma el pedido.

## Decisiones del dueño

- Timeouts configurables por admin (default 5 min aceptación, 10 min concurso).
- Solo pedidos inmediatos; los programados siguen con propuestas sin cambios.
- Enfoque A: estados nuevos + sweeper con timestamps (sin Redis, sin setTimeout).

## Estados y datos

- `OrderStatus` suma `pending_acceptance` (asignado, esperando Aceptar del
  driver) y `no_driver` (concurso vencido sin tomador). Migración de enum.
- El concurso reutiliza `pending` (ya es la vitrina que cualquier driver
  puede tomar con claim atómico).
- `Order` suma `acceptanceExpiresAt`, `contestStartedAt`, `contestEndsAt`.
- Tabla nueva `OrderEvent`: `orderId`, `type` (assigned, accepted,
  rejected, acceptance_expired, contest_started, contest_expired,
  no_driver), `actorId?`, `driverId?`, `meta Json?`, `createdAt`. Con los
  campos de `Order` + eventos se reconstruye: hora de asignación inicial,
  repartidor inicial, vencimiento de 5 min, inicio/fin del concurso y
  resultado final.

## Sweeper y atomicidad

- Servicio `AssignmentSweeper` con `setInterval` cada 60 segundos.
- Cada barrido reclama vencidos con `updateMany` atómico condicionado a
  estado exacto + deadline pasada:
  - `pending_acceptance` + `acceptanceExpiresAt` pasada → `pending` con
    `contestStartedAt=ahora`, `contestEndsAt=ahora+contestMinutes`.
  - `pending` + `contestEndsAt` pasada + `driverId=null` → `no_driver`.
- Solo quien gana el reclamo transiciona y notifica: restart-safe (todo vive
  en DB), sin timers duplicados ni doble procesamiento multi-instancia,
  sin dependencias nuevas.
- Pedidos cancelados/entregados nunca matchean la condición de estado
  exacto: los timers vencidos no los tocan.
- Timeouts desde `PlatformSetting` (`assignment.acceptanceMinutes=5`,
  `assignment.contestMinutes=10`), editables en admin/settings.

## Transiciones y notificaciones

- `assignDriver` (solo `orderType=immediate`): deja `pending_acceptance` con
  `assignedAt` y `acceptanceExpiresAt`, crea evento `assigned`, notifica al
  driver seleccionado.
- Nuevo `POST /orders/:id/accept-assignment`: solo el driver asignado y solo
  en `pending_acceptance` → `assigned` (claim atómico), evento `accepted`,
  se cancela el deadline implícitamente (el sweeper ya no matchea).
- Rechazo en `pending_acceptance` (endpoint de reject existente extendido):
  abre concurso inmediato (`pending` + ventana de 10 min), evento
  `rejected` + `contest_started`, avisa al comercio y re-alerta a la flota
  con `alertNearbyDrivers` existente.
- En concurso vale el claim atómico de `acceptOrderAsDriver`: el primero
  gana → `assigned` (limpia campos de concurso), evento `accepted`,
  notifica al comercio y emite `order:taken` para ocultar el pedido al resto.
- Concurso vencido → `no_driver`, evento `no_driver`, notifica al comercio:
  "No hay repartidores disponibles para aceptar este pedido en este
  momento." El pedido deja de aparecer en Disponibles.
- Idempotencia: solo el ganador del claim notifica; los eventos se crean
  junto a la transición ganadora.

## Apps

- Driver: en `pending_acceptance` ve Aceptar/Rechazar con cuenta regresiva
  (deadline del servidor); en `no_driver` el pedido desaparece de
  Disponibles.
- Comercio: ve `pending_acceptance` (esperando al driver), concurso
  (buscando repartidor), quién aceptó y `no_driver` con el aviso.
- Tracking: etiquetas para los dos estados nuevos (es-CR).

## Testing (criterios de aceptación del pedido)

1. Acepta en <5 min → asignado. 2. Rechaza → concurso inmediato.
2. Sin respuesta 5 min → concurso. 4. Acepta en concurso → asignado y fin
   del concurso. 5. Doble accept simultáneo → solo un ganador (claim
   atómico). 6. 10 min sin tomador → `no_driver` + aviso al comercio.
3. Cancelado antes del vencimiento → el sweeper no lo toca. 8. Reinicio del
   backend con timers corridos → el sweeper continúa por timestamps.
4. Sin notificaciones duplicadas. 10. Flujo actual intacto (tests
   existentes en verde).
