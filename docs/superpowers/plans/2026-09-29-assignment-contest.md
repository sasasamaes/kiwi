# Asignación con timeout, concurso y sin-repartidor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Asignar a un driver con aceptación en 5 min, concurso de 10 min si no responde, y estado sin-repartidor con aviso si nadie lo toma.

**Architecture:** Dos estados nuevos (`pending_acceptance`, `no_driver`) + 3 timestamps en `Order` + tabla `OrderEvent` + sweeper cada 60s con claims atómicos + timeouts en `PlatformSetting`. El concurso reutiliza `pending` y el claim atómico existente.

**Tech Stack:** Prisma/Postgres, NestJS (setInterval en provider con onModuleInit/onModuleDestroy), Next.js, Jest.

## Global Constraints

- Precios en colones (₡), español voseo es-CR en UI, notificaciones y errores.
- Solo pedidos inmediatos; los programados (`driver_proposals`/propuestas) no se tocan.
- Sin dependencias nuevas (nada de Redis/BullMQ).
- Notificaciones solo las envía quien gana el claim atómico (idempotencia por construcción).
- Commits convencionales, sin atribución AI.

---

## File structure

- `api/prisma/schema.prisma` — enum + campos + `OrderEvent`. Solo modelo de datos.
- `packages/types/src/index.ts` — unión `OrderStatus`. Solo tipos compartidos.
- `api/src/settings/settings.service.ts` — sección `assignment`. Solo defaults/validación.
- `apps/web/app/admin/settings/page.tsx` — tab de timeouts. Solo UI admin.
- `api/src/orders/orders.service.ts` — transiciones. Solo reglas de dominio.
- `api/src/orders/orders.controller.ts` — `POST :id/accept-assignment`. Solo routing.
- `api/src/orders/assignment-sweeper.service.ts` — barrido cada 60s. Solo expiraciones.
- `api/src/orders/orders.module.ts` — registra el sweeper. Solo wiring.
- `api/src/notifications/notifications.service.ts` — 3 push dedicados + 2 entradas de mensajes. Solo notificaciones.
- `apps/driver/app/active/page.tsx` + `apps/driver/app/page.tsx` — Aceptar/Rechazar + countdown. Solo UI driver.
- `apps/web/app/orders/page.tsx` + `apps/web/app/admin/orders/page.tsx` + `apps/client/app/tracking/[id]/page.tsx` — etiquetas nuevas. Solo lectura.
- `api/src/__tests__/assignment-contest.spec.ts` — los 10 criterios. Solo tests.

---

### Task 1: DB — estados, timestamps y auditoría

**Files:**

- Modify: `api/prisma/schema.prisma` (enum `OrderStatus`, modelo `Order`, nuevo modelo `OrderEvent`)
- Modify: `packages/types/src/index.ts` (línea ~106, unión de estados)
- Create: el `migration.sql` que genera el comando del Step 2

**Interfaces:**

- Consumes: nada.
- Produces: `OrderStatus` con `'pending_acceptance' | 'no_driver'`; `Order.acceptanceExpiresAt / contestStartedAt / contestEndsAt`; modelo `OrderEvent`.

- [ ] **Step 1: Editar el schema**

En `enum OrderStatus` (líneas ~361-370) agregar tras `assigned` y al final respectivamente:

```prisma
enum OrderStatus {
  pending
  driver_proposals
  assigned
  pending_acceptance
  in_transit_to_pickup
  picked_up
  in_transit_to_delivery
  delivered
  cancelled
  no_driver
}
```

En `model Order`, tras `deliveredAt DateTime? @map("delivered_at")` (línea ~339):

```prisma
  // Asignación con aceptación: deadline del driver y ventana de concurso.
  acceptanceExpiresAt DateTime? @map("acceptance_expires_at")
  contestStartedAt    DateTime? @map("contest_started_at")
  contestEndsAt       DateTime? @map("contest_ends_at")
```

Al final del archivo, nuevo modelo:

```prisma
// Auditoría de asignación/concurso por pedido (quién, cuándo, resultado).
model OrderEvent {
  id        String   @id @default(uuid())
  orderId   String   @map("order_id")
  type      String
  actorId   String?  @map("actor_id")
  driverId  String?  @map("driver_id")
  meta      Json?
  createdAt DateTime @default(now()) @map("created_at")

  @@index([orderId, createdAt])
  @@map("order_events")
}
```

Tipos de `type`: `assigned`, `accepted`, `rejected`, `acceptance_expired`, `contest_started`, `contest_expired`, `no_driver`.

- [ ] **Step 2: Migrar y validar**

Run: `npx prisma migrate dev --name assignment_contest` (con `--schema api/prisma/schema.prisma` si hace falta)
Expected: migración creada y aplicada. Luego `npx prisma validate` → schema válido.

- [ ] **Step 3: Actualizar la unión en packages/types**

En `packages/types/src/index.ts` línea ~106, donde está `| 'picked_up'`, agregar `| 'pending_acceptance'` y `| 'no_driver'` a la unión `OrderStatus`.

- [ ] **Step 4: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations packages/types/src/index.ts
git commit -m "feat(orders): estados pending_acceptance y no_driver con OrderEvent"
```

---

### Task 2: Timeouts configurables en admin

**Files:**

- Modify: `api/src/settings/settings.service.ts` (interfaz, defaults, KNOWN_KEYS, loadAll, saveAll, getter)
- Modify: `apps/web/app/admin/settings/page.tsx` (estado inicial, merge en carga/guardado, tab, inputs)

**Interfaces:**

- Consumes: `PlatformSetting` (key-value existente).
- Produces: `settingsService.getAssignmentTimeouts(): Promise<{ acceptanceMinutes: number; contestMinutes: number }>`.

- [ ] **Step 1: Test que falla del getter**

Crear `api/src/__tests__/assignment-settings.spec.ts`:

```ts
import { SettingsService } from '../settings/settings.service';

function serviceWith(rows: any[]) {
  const prisma: any = { platformSetting: { findMany: jest.fn().mockResolvedValue(rows) } };
  return new SettingsService(prisma);
}

it('defaults 5 y 10 sin filas', async () => {
  const res = await serviceWith([]).getAssignmentTimeouts();
  expect(res).toEqual({ acceptanceMinutes: 5, contestMinutes: 10 });
});

it('respeta valores guardados y sanea a 1..60', async () => {
  const svc = serviceWith([
    { key: 'assignment', value: { acceptanceMinutes: 3, contestMinutes: 99 } },
  ]);
  const res = await svc.getAssignmentTimeouts();
  expect(res).toEqual({ acceptanceMinutes: 3, contestMinutes: 60 });
});
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npx jest api/src/__tests__/assignment-settings.spec.ts -v`
Expected: FAIL (`getAssignmentTimeouts is not a function`).

- [ ] **Step 3: Implementar la sección `assignment`**

En `settings.service.ts`: a la interfaz `PlatformSettings` agregar

```ts
assignment: {
  acceptanceMinutes: number;
  contestMinutes: number;
}
```

En `DEFAULT_SETTINGS` agregar `assignment: { acceptanceMinutes: 5, contestMinutes: 10 },`. En `KNOWN_KEYS` agregar `'assignment'`. En `loadAll` agregar `assignment: { ...DEFAULT_SETTINGS.assignment, ...(stored.assignment ?? {}) },`. En `saveAll`: incluir `assignment` en la construcción de `next` igual que las demás secciones, y sanear con

```ts
const clampMin = (v: unknown, dflt: number) =>
  Math.min(Math.max(Math.round(Number(v) || dflt), 1), 60);
next.assignment.acceptanceMinutes = clampMin(next.assignment.acceptanceMinutes, 5);
next.assignment.contestMinutes = clampMin(next.assignment.contestMinutes, 10);
```

Agregar el getter:

```ts
/** Minutos de aceptación y de concurso (admin, default 5/10, saneado 1–60). */
async getAssignmentTimeouts(): Promise<{ acceptanceMinutes: number; contestMinutes: number }> {
  const all = await this.getAll();
  const clamp = (v: unknown, dflt: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 60) : dflt;
  };
  return {
    acceptanceMinutes: clamp(all.assignment?.acceptanceMinutes, 5),
    contestMinutes: clamp(all.assignment?.contestMinutes, 10),
  };
}
```

- [ ] **Step 4: Correr tests**

Run: `npx jest api/src/__tests__/assignment-settings.spec.ts -v`
Expected: PASS 2/2.

- [ ] **Step 5: Tab en admin/settings**

En `apps/web/app/admin/settings/page.tsx`, replicando el patrón de `operations`: agregar `assignment: { acceptanceMinutes: 5, contestMinutes: 10 }` al estado inicial, a los dos merges (`data?.assignment`, `saved?.assignment`), al tipo de `activeTab`, un tab `{ id: 'assignment', label: 'Asignación', icon: Timer }` (importar `Timer` de lucide-react) y el bloque:

```tsx
{
  activeTab === 'assignment' && (
    <motion.div
      className="rounded-2xl glass p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-1">
        Tiempos de asignación
      </h3>
      <p className="mb-6 text-sm text-surface-500 dark:text-surface-400">
        Cuánto espera un pedido al repartidor seleccionado antes de entrar en concurso, y cuánto
        dura el concurso.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Minutos para aceptar (1–60)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={settings.assignment.acceptanceMinutes}
            onChange={(e) =>
              setSettings({
                ...settings,
                assignment: { ...settings.assignment, acceptanceMinutes: Number(e.target.value) },
              })
            }
            className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Minutos de concurso (1–60)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={settings.assignment.contestMinutes}
            onChange={(e) =>
              setSettings({
                ...settings,
                assignment: { ...settings.assignment, contestMinutes: Number(e.target.value) },
              })
            }
            className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
          />
        </div>
      </div>
    </motion.div>
  );
}
```

Además: importar `Timer` en la lista de lucide-react (línea ~6-20), agregar el tab `{ id: 'assignment', label: 'Asignación', icon: Timer }` junto al de `operations` (línea ~154) y `'assignment'` al tipo de `activeTab` (líneas ~84-86).

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json` y `npx tsc --noEmit -p api/tsconfig.json`. Expected: PASS.

```bash
git add api/src/settings/settings.service.ts api/src/__tests__/assignment-settings.spec.ts apps/web/app/admin/settings/page.tsx
git commit -m "feat(settings): timeouts de aceptacion y concurso configurables"
```

---

### Task 3: Transiciones del flujo

**Files:**

- Modify: `api/src/orders/orders.service.ts` (`assignDriver`, nuevo `acceptAssignment`, `rejectOrderAsDriver`, `acceptOrderAsDriver`, `validateStatusTransition`, `validateStatusActor`, `getPublicTracking`, `merchantLabels`/`driverLabels`)
- Modify: `api/src/orders/orders.controller.ts` (nuevo `POST :id/accept-assignment`)
- Test: `api/src/__tests__/assignment-contest.spec.ts` (se crea en el Task 6; este task corre los suites existentes)

**Interfaces:**

- Consumes: Task 1 (campos/estados), Task 2 (`getAssignmentTimeouts`).
- Produces: `acceptAssignment(orderId, driverUserId)`; `assignDriver` deja `pending_acceptance` en inmediatos.

- [ ] **Step 1: `assignDriver` → `pending_acceptance` (solo inmediatos)**

Tras el ownership check (línea ~1421), leer tipo y timeouts:

```ts
const target = await this.prisma.order.findUnique({
  where: { id: orderId },
  select: { orderType: true },
});
const { acceptanceMinutes } = await this.settingsService.getAssignmentTimeouts();
```

Si `target?.orderType === 'scheduled'`, mantener el claim actual a `assigned` sin cambios. Si es inmediato, cambiar el `data` del claim (líneas ~1430-1434) por:

```ts
data: {
  driverId,
  status: 'pending_acceptance',
  assignedAt: new Date(),
  acceptanceExpiresAt: new Date(Date.now() + acceptanceMinutes * 60_000),
  contestStartedAt: null,
  contestEndsAt: null,
},
```

Tras obtener `updatedOrder`, crear el evento y notificar al driver:

```ts
await this.prisma.orderEvent.create({
  data: { orderId, type: 'assigned', actorId: merchantUserId ?? null, driverId },
});
this.eventsGateway.sendToUser(driverProfile.userId, 'order:assignmentOffered', {
  orderId,
  message: `Tenés un pedido pendiente de aceptación (${acceptanceMinutes} min para aceptar)`,
});
void this.notificationsService
  .notifyAssignmentOffered(orderId, driverProfile.userId, acceptanceMinutes)
  .catch(() => undefined);
```

(`notifyAssignmentOffered` se crea en el Task 4; hasta entonces este task usa solo `eventsGateway` + `notifyOrderStatusUpdate`. Para no bloquear: este task deja el `sendToUser` + evento, y el Task 4 agrega el push dedicado.)

- [ ] **Step 2: Nuevo `acceptAssignment` + endpoint**

En el service, tras `assignDriver`:

```ts
/** El driver asignado acepta dentro del plazo: pending_acceptance → assigned. */
async acceptAssignment(orderId: string, driverUserId: string) {
  const driverProfile = await this.prisma.driverProfile.findUnique({ where: { userId: driverUserId } });
  if (!driverProfile) throw new NotFoundException('Perfil de repartidor no encontrado');
  const claimed = await this.prisma.order.updateMany({
    where: { id: orderId, driverId: driverProfile.id, status: 'pending_acceptance', acceptanceExpiresAt: { gt: new Date() } },
    data: { status: 'assigned', acceptanceExpiresAt: null },
  });
  if (claimed.count === 0) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new NotFoundException('Pedido no encontrado');
    throw new BadRequestException('El pedido ya no está pendiente de tu aceptación');
  }
  await this.prisma.orderEvent.create({ data: { orderId, type: 'accepted', driverId: driverProfile.id } });
  const updated = await this.prisma.order.findUnique({ where: { id: orderId }, include: { merchant: true, driver: true } });
  if (updated?.merchant?.userId) {
    this.eventsGateway.sendToUser(updated.merchant.userId, 'order:accepted', {
      orderId, driverName: driverProfile.fullName, message: `${driverProfile.fullName} aceptó tu pedido`,
    });
  }
  return updated;
}
```

En el controller, junto a `POST :id/accept`:

```ts
@Post(':id/accept-assignment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('driver')
@ApiBearerAuth()
@ApiOperation({ summary: 'Assigned driver accepts within the acceptance window' })
async acceptAssignment(@Param('id') id: string, @CurrentUser() user: any) {
  return this.ordersService.acceptAssignment(id, user.sub);
}
```

- [ ] **Step 3: Rechazo abre concurso inmediato + concurso con ventana**

En `rejectOrderAsDriver`: ampliar el `where` del claim (línea ~1830) a `status: { in: ['assigned', 'in_transit_to_pickup', 'pending_acceptance'] }` y, tras el claim, leer timeouts y abrir concurso:

```ts
const { contestMinutes } = await this.settingsService.getAssignmentTimeouts();
await this.prisma.order.update({
  where: { id: orderId },
  data: {
    driverId: null,
    status: 'pending',
    assignedAt: null,
    acceptanceExpiresAt: null,
    contestStartedAt: new Date(),
    contestEndsAt: new Date(Date.now() + contestMinutes * 60_000),
  },
});
await this.prisma.orderEvent.create({
  data: { orderId, type: 'rejected', driverId: driverProfile.id },
});
await this.prisma.orderEvent.create({
  data: { orderId, type: 'contest_started', meta: { reason: 'rejected' } },
});
```

El `data` del claim original (`{ driverId: null, status: 'pending', assignedAt: null }`) se reemplaza por este update posterior en la misma función (hacerlo en transacción `$transaction` si es simple; si no, secuencial como el resto del archivo). Mantener los avisos existentes al comercio y el `alertNearbyDrivers`.
En `acceptOrderAsDriver`: el claim (línea ~1737) hoy es `where: { id, status: 'pending', driverId: null }`. Cambiarlo a:

```ts
where: {
  id: orderId, status: 'pending', driverId: null,
  OR: [{ contestEndsAt: null }, { contestEndsAt: { gte: new Date() } }],
},
```

Así el `pending` clásico (sin ventana) sigue tomándose siempre y el de concurso solo dentro de la ventana. Tras ganar, limpiar `contestStartedAt/contestEndsAt` a null en el mismo `data` y crear evento `accepted`.

- [ ] **Step 4: Mapas de transición + etiquetas + tracking**

En `validateStatusTransition`: `pending: ['assigned', 'cancelled']` pasa a `pending: ['assigned', 'pending_acceptance', 'cancelled', 'no_driver']`; agregar `pending_acceptance: ['assigned', 'pending', 'cancelled']` y `no_driver: []`. En `validateStatusActor`: agregar `'pending→pending_acceptance'` y `'pending→no_driver'` al set del comercio? No: esas las mueve el sweeper con rol admin (bypass). Agregar `'pending_acceptance→assigned'` al set del driver (acepta) — el sweeper usa rol admin. El rechazo ya está cubierto por `rejectOrderAsDriver` (endpoint propio, no `updateStatus`).
En `merchantLabels`/`driverLabels` de `updateStatus` agregar `pending_acceptance: '#..: esperando aceptación del repartidor'` y `no_driver: '#..: sin repartidores disponibles'`, y en `notifyOrderStatusUpdate` (notifications.service) agregar entradas `pending_acceptance` y `no_driver` en ambos mapas con el mismo formato que las existentes.
En `getPublicTracking`: incluir `acceptanceExpiresAt, contestStartedAt, contestEndsAt` en la respuesta (agregar al select/objeto explícito igual que se hizo con las fotos de evidencia).

- [ ] **Step 5: Correr suites existentes**

Run: `npx jest api/src/__tests__/orders.service.spec.ts api/src/__tests__/orders.integration.spec.ts -v`
Expected: PASS. Si un test viejo asume `assignDriver` → `assigned` en inmediatos, actualizar su fixture a `pending_acceptance` (igual que se hizo con las fotos: fixtures, no assertions).

- [ ] **Step 6: Commit**

```bash
git add api/src/orders/orders.service.ts api/src/orders/orders.controller.ts api/src/notifications/notifications.service.ts
git commit -m "feat(orders): aceptacion con timeout y concurso inmediato al rechazar"
```

---

### Task 4: Sweeper de expiraciones

**Files:**

- Create: `api/src/orders/assignment-sweeper.service.ts`
- Modify: `api/src/orders/orders.module.ts` (provider)
- Modify: `api/src/notifications/notifications.service.ts` (3 push dedicados)
- Test: se cubre en el Task 6 con `sweepOnce()` directo

**Interfaces:**

- Consumes: Task 1 (campos), Task 2 (timeouts), Task 3 (eventos/estados).
- Produces: `sweepOnce(): Promise<{ acceptanceExpired: number; contestsExpired: number }>`.

- [ ] **Step 1: Push dedicados en notifications.service**

Junto a `notifyOrderAccepted` (línea ~487), agregar:

```ts
/** Te asignaron un pedido: tenés N minutos para aceptar. */
async notifyAssignmentOffered(orderId: string, driverUserId: string, minutes: number) {
  return this.sendToUser(driverUserId, {
    title: '🛵 Tenés un pedido para aceptar',
    body: `Tenés ${minutes} min para aceptarlo antes de que vuelva a concurso. Pedido #${orderId.slice(0, 8)}`,
    data: { orderId, type: 'assignment_offered' },
  });
}

/** El driver inicial no aceptó: el pedido entró en concurso. */
async notifyContestStarted(orderId: string, merchantUserId: string) {
  return this.sendToUser(merchantUserId, {
    title: '🔍 Buscando otro repartidor',
    body: `El repartidor seleccionado no aceptó tu pedido #${orderId.slice(0, 8)}. Ya está en concurso.`,
    data: { orderId, type: 'contest_started' },
  });
}

/** Nadie tomó el pedido en el concurso. */
async notifyNoDriverAvailable(orderId: string, merchantUserId: string) {
  return this.sendToUser(merchantUserId, {
    title: '⚠️ Sin repartidores disponibles',
    body: 'No hay repartidores disponibles para aceptar este pedido en este momento.',
    data: { orderId, type: 'no_driver' },
  });
}
```

Y en `assignDriver` (Task 3 dejó solo gateway+evento) agregar el push:

```ts
void this.notificationsService
  .notifyAssignmentOffered(orderId, driverProfile.userId, acceptanceMinutes)
  .catch(() => undefined);
```

al lado del `sendToUser('order:assignmentOffered', ...)`.

- [ ] **Step 2: Crear el sweeper**

`api/src/orders/assignment-sweeper.service.ts`:

```ts
// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from './orders.service';

/**
 * Expira aceptaciones y concursos vencidos. Todo vive en DB (timestamps):
 * un reinicio no pierde nada; el próximo barrido continúa. Cada transición
 * es un claim atómico (estado exacto + deadline) así que N instancias no
 * duplican trabajo ni notificaciones: solo el ganador notifica.
 */
@Injectable()
export class AssignmentSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssignmentSweeper.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private static readonly INTERVAL_MS = 60_000;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private events: EventsGateway,
    private notifications: NotificationsService,
    private orders: OrdersService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      void this.sweepOnce().catch((e) => this.logger.error(`sweep failed: ${String(e)}`));
    }, AssignmentSweeper.INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweepOnce(): Promise<{ acceptanceExpired: number; contestsExpired: number }> {
    if (this.running) return { acceptanceExpired: 0, contestsExpired: 0 };
    this.running = true;
    try {
      const { contestMinutes } = await this.settings.getAssignmentTimeouts();
      const now = new Date();
      let acceptanceExpired = 0;
      let contestsExpired = 0;

      const expired = await this.prisma.order.findMany({
        where: { status: 'pending_acceptance', acceptanceExpiresAt: { lt: now } },
        select: { id: true, driverId: true, merchantId: true },
      });
      for (const o of expired) {
        const claimed = await this.prisma.order.updateMany({
          where: {
            id: o.id,
            status: 'pending_acceptance',
            acceptanceExpiresAt: { lt: new Date() },
          },
          data: {
            driverId: null,
            status: 'pending',
            assignedAt: null,
            acceptanceExpiresAt: null,
            contestStartedAt: now,
            contestEndsAt: new Date(now.getTime() + contestMinutes * 60_000),
          },
        });
        if (claimed.count === 0) continue;
        acceptanceExpired++;
        await this.prisma.orderEvent.create({
          data: { orderId: o.id, type: 'acceptance_expired', driverId: o.driverId },
        });
        await this.prisma.orderEvent.create({
          data: { orderId: o.id, type: 'contest_started', meta: { reason: 'timeout' } },
        });
        const full: any = await this.prisma.order.findUnique({
          where: { id: o.id },
          include: { merchant: true },
        });
        if (full?.merchant?.userId) {
          this.events.sendToUser(full.merchant.userId, 'order:contestStarted', {
            orderId: o.id,
            message: 'El repartidor no aceptó a tiempo: el pedido entró en concurso.',
          });
          void this.notifications
            .notifyContestStarted(o.id, full.merchant.userId)
            .catch(() => undefined);
        }
        if (full) {
          void this.orders.alertNearbyDrivers(full, {
            id: full.id,
            orderId: full.id,
            pickupAddress: full.pickupAddress,
            deliveryAddress: full.deliveryAddress,
            deliveryZone: full.deliveryZone ?? null,
            totalAmount: Number(full.totalAmount),
            driverPayout: full.driverPayout != null ? Number(full.driverPayout) : null,
            distanceKm: Number(full.distanceKm),
            merchantName: full.merchant?.businessName,
            createdAt: full.createdAt,
          });
        }
      }

      const stale = await this.prisma.order.findMany({
        where: { status: 'pending', driverId: null, contestEndsAt: { lt: now } },
        select: { id: true },
      });
      for (const o of stale) {
        const claimed = await this.prisma.order.updateMany({
          where: { id: o.id, status: 'pending', driverId: null, contestEndsAt: { lt: new Date() } },
          data: { status: 'no_driver', contestStartedAt: null, contestEndsAt: null },
        });
        if (claimed.count === 0) continue;
        contestsExpired++;
        await this.prisma.orderEvent.create({ data: { orderId: o.id, type: 'contest_expired' } });
        await this.prisma.orderEvent.create({ data: { orderId: o.id, type: 'no_driver' } });
        const full: any = await this.prisma.order.findUnique({
          where: { id: o.id },
          include: { merchant: true },
        });
        if (full?.merchant?.userId) {
          this.events.sendToUser(full.merchant.userId, 'order:noDriver', {
            orderId: o.id,
            message: 'No hay repartidores disponibles para aceptar este pedido en este momento.',
          });
          void this.notifications
            .notifyNoDriverAvailable(o.id, full.merchant.userId)
            .catch(() => undefined);
        }
      }
      return { acceptanceExpired, contestsExpired };
    } finally {
      this.running = false;
    }
  }
}
```

Nota: `alertNearbyDrivers` hoy es método de `OrdersService` — verificar que sea público; si es `private`, cambiarlo a público en este task (una palabra, mismo archivo).

- [ ] **Step 3: Registrar en el módulo**

En `api/src/orders/orders.module.ts`: `import { AssignmentSweeper } from './assignment-sweeper.service';` y `providers: [OrdersService, ImageUploadService, AssignmentSweeper]`. Verificar import circular: el sweeper importa `OrdersService` del mismo módulo (bien) y `NotificationsService` que ya llega vía `@Global` (igual que en `OrdersService`).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p api/tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/orders/assignment-sweeper.service.ts api/src/orders/orders.module.ts api/src/notifications/notifications.service.ts api/src/orders/orders.service.ts
git commit -m "feat(orders): sweeper de aceptaciones y concursos vencidos"
```

---

### Task 5: Pantallas driver, comercio, tracking y admin

**Files:**

- Modify: `apps/driver/app/active/page.tsx` (card Aceptar/Rechazar + countdown en `pending_acceptance`)
- Modify: `apps/driver/app/page.tsx` (sumar `'pending_acceptance'` a `ACTIVE_STATUSES` línea ~201 y etiqueta en su mapa ~línea 377)
- Modify: `packages/ui/src/api-client.ts` (método `acceptAssignment`)
- Modify: `apps/web/app/orders/page.tsx` (etiquetas `pending_acceptance`/`no_driver` en `STATUS_LABELS`, colores y timeline)
- Modify: `apps/web/app/admin/orders/page.tsx` (mismas etiquetas)
- Modify: `apps/client/app/tracking/[id]/page.tsx` (mismas etiquetas)

**Interfaces:**

- Consumes: Task 3 (`POST :id/accept-assignment`), Task 1 (estados).
- Produces: UI completa del flujo.

- [ ] **Step 1: Método en api-client**

Junto a los métodos de órdenes (cerca de `updateOrderStatus`), agregar:

```ts
async acceptAssignment(orderId: string) {
  return this.request<any>(`/orders/${orderId}/accept-assignment`, { method: 'POST' });
}
```

Verificar el nombre exacto del helper (`this.request`) y la firma de `updateOrderStatus` en el archivo antes de escribir.

- [ ] **Step 2: Driver acepta/rechaza con countdown**

En `apps/driver/app/active/page.tsx`: cuando `order.status === 'pending_acceptance'`, mostrar card con `acceptanceExpiresAt` (cuenta regresiva `mm:ss` con `setInterval` local de 1s, mismo estilo de la página) y dos botones: `Aceptar pedido` → `api.acceptAssignment(order.id)` + refresh; `Rechazar` → `api.rejectOrder(order.id)` existente + refresh. El `NEXT_STATUS` no incluye `pending_acceptance`: la barra de acción fija no debe mostrarse en ese estado (condicionar su render a `order.status !== 'pending_acceptance'`).
En `apps/driver/app/page.tsx`: agregar `'pending_acceptance'` a `ACTIVE_STATUSES` y su etiqueta (p. ej. `'Pendiente de aceptación'`) en el mapa de etiquetas cercano a la línea 377.

- [ ] **Step 3: Etiquetas en comercio, admin y tracking**

`pending_acceptance: 'Esperando al repartidor'`, `no_driver: 'Sin repartidores'`. Agregar a: `STATUS_LABELS` + mapa de colores + timeline (`at: o.assignedAt`) en `apps/web/app/orders/page.tsx` (líneas ~26-74); mapa de `apps/web/app/admin/orders/page.tsx` (líneas ~46-57); mapa de `apps/client/app/tracking/[id]/page.tsx` (líneas ~29-30 y ~143). En tracking, `no_driver` muestra el aviso "No hay repartidores disponibles en este momento.".

- [ ] **Step 4: Typechecks**

Run: `npx tsc --noEmit -p apps/driver/tsconfig.json`, `apps/web`, `apps/client`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/api-client.ts apps/driver/app/active/page.tsx apps/driver/app/page.tsx apps/web/app/orders/page.tsx apps/web/app/admin/orders/page.tsx apps/client/app/tracking/\[id\]/page.tsx
git commit -m "feat(app): aceptar y rechazar asignacion con cuenta regresiva"
```

---

### Task 6: Tests de los 10 criterios + suite verde

**Files:**

- Create: `api/src/__tests__/assignment-contest.spec.ts`
- Modify: fixtures viejas solo si fallan por la nueva semántica (igual que fotos: fixtures, no assertions)

**Interfaces:**

- Consumes: Tasks 1-4.
- Produces: suite verde completa.

- [ ] **Step 1: Escribir los tests (mock de Prisma igual que `orders.service.spec.ts`)**

```ts
import { OrdersService } from '../orders/orders.service';
import { AssignmentSweeper } from '../orders/assignment-sweeper.service';

const prisma: any = {
  order: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  driverProfile: { findUnique: jest.fn() },
  merchantProfile: { findUnique: jest.fn() },
  driverProposal: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  orderEvent: { create: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(prisma)),
};
const events: any = { sendToUser: jest.fn(), sendToRole: jest.fn() };
const notifications: any = {
  notifyOrderStatusUpdate: jest.fn(),
  notifyOrderAccepted: jest.fn(),
  notifyOrderRejected: jest.fn(),
  notifyAssignmentOffered: jest.fn(),
  notifyContestStarted: jest.fn(),
  notifyNoDriverAvailable: jest.fn(),
};
const settings: any = {
  getAssignmentTimeouts: jest.fn().mockResolvedValue({ acceptanceMinutes: 5, contestMinutes: 10 }),
};
```

Casos (usar `service.updateStatus`/`assignDriver`/`acceptAssignment`/`rejectOrderAsDriver`/`acceptOrderAsDriver` y `sweeper.sweepOnce()` con `prisma.order.findMany` devolviendo vencidos):

1. `acceptAssignment` dentro del plazo → `assigned` (claim con `acceptanceExpiresAt > ahora`).
2. `rejectOrderAsDriver` en `pending_acceptance` → `pending` con `contestEndsAt` ≈ +10 min y eventos `rejected`+`contest_started`.
3. `sweepOnce` con `pending_acceptance` vencida → `pending` en concurso + `notifyContestStarted` llamado 1 vez.
4. `acceptOrderAsDriver` en `pending` de concurso → `assigned` y limpia `contestEndsAt`.
5. Doble claim: primer `updateMany` count 1, segundo count 0 → el segundo lanza "ya tomó".
6. `sweepOnce` con `pending` + `contestEndsAt` pasada + `driverId null` → `no_driver` + `notifyNoDriverAvailable` con el mensaje exacto del criterio.
7. `sweepOnce` ignora `cancelled`/`delivered` aunque tengan deadlines viejas.
8. `sweepOnce` procesa vencidos "de antes del reinicio" (fechas pasadas) → transiciona igual.
9. `sweepOnce` con el mismo vencido dos veces seguidas → segunda vez 0 cambios y sin notificar (el claim ya no matchea).
10. `acceptOrderAsDriver` en `pending` clásico sin `contestEndsAt` → `assigned` (compatibilidad con flujo actual).

- [ ] **Step 2: Correr el spec nuevo**

Run: `npx jest api/src/__tests__/assignment-contest.spec.ts -v`
Expected: primero FAIL (ajustar mocks al código real), iterar hasta PASS total.

- [ ] **Step 3: Suite completa**

Run: `npx jest api/src/__tests__ -v`
Expected: todo PASS incluyendo `orders.service.spec.ts` e integración.

- [ ] **Step 4: Commit**

```bash
git add api/src/__tests__/assignment-contest.spec.ts
git commit -m "test(orders): criterios de aceptacion del concurso de asignacion"
```
