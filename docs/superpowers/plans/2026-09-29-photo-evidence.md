# Evidencia fotográfica 1+1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El pedido exige 1 foto del comercio al entregar al driver y 1 foto del driver al entregar al cliente, y los términos lo respaldan.

**Architecture:** 4 campos nuevos en `Order` + endpoint de subida que reutiliza la validación Cloudinary existente + bloqueo en `updateStatus` + UI de cámara en comercio/driver + textos legales.

**Tech Stack:** Prisma/Postgres, NestJS (multer memoryStorage + Cloudinary), Next.js (file input con capture), Jest.

## Global Constraints

- Precios en colones (₡), español voseo es-CR en UI y legales.
- Imágenes: JPG/PNG/WEBP/GIF, máx 5 MB, validación por magic bytes (no confiar en extensión).
- Sin promesas legales que el producto no cumpla; revisión legal profesional antes de producción.
- Commits convencionales, sin atribución AI.

---

## File structure

- `api/prisma/schema.prisma` — 4 campos en `Order` (URLs + timestamps). Una sola responsabilidad: modelo de datos.
- `api/prisma/migrations/XXXX_add_order_proof_photos/migration.sql` — migración generada por Prisma. Solo DDL.
- `api/src/orders/orders.controller.ts` — suma `POST :id/proof-photo` y acepta `proofPhotoUrl` opcional en `PUT :id/status`. Solo routing/auth.
- `api/src/orders/orders.service.ts` — `uploadProofPhoto()` + exigencia de foto en `updateStatus()`. Solo reglas de dominio.
- `api/src/menu/image-upload.service.ts` — suma método `uploadProofImage()` (carpeta `kiwi/proofs`). Solo subida.
- `packages/ui/src/api-client.ts` — suma `uploadOrderProofPhoto(orderId, kind, file)`. Solo HTTP.
- `apps/web/app/orders/page.tsx` — botón subir foto pickup (comercio). Solo UI comercio.
- `apps/driver/app/active/page.tsx` — pasos de foto pickup/delivery + bloqueo. Solo UI driver.
- `apps/client/app/tracking/[id]/page.tsx` + `apps/web/app/admin/orders/page.tsx` — muestran las 2 fotos. Solo lectura.
- `packages/ui/src/legal.ts` — sección evidencia en terms/refunds/privacy. Solo textos.
- `api/src/__tests__/orders.proof-photo.spec.ts` — tests nuevos. Solo tests.

---

### Task 1: Migración Prisma (campos de evidencia)

**Files:**

- Modify: `api/prisma/schema.prisma` (modelo `Order`, tras `deliveredAt`)
- Create: el `migration.sql` que genera el comando del Step 2 dentro de `api/prisma/migrations/`
- Verifica: `npx prisma validate` (los tests que usan los campos llegan en el Task 2)

**Interfaces:**

- Consumes: nada (primera tarea).
- Produces: `Order.pickupProofPhotoUrl: string | null`, `Order.pickupProofAt: Date | null`, `Order.deliveryProofPhotoUrl: string | null`, `Order.deliveryProofAt: Date | null`.

- [ ] **Step 1: Agregar los 4 campos al modelo Order**

```prisma
  // Evidencia fotográfica 1+1 (obligatoria para avanzar).
  pickupProofPhotoUrl    String?   @map("pickup_proof_photo_url")
  pickupProofAt          DateTime? @map("pickup_proof_at")
  deliveryProofPhotoUrl  String?   @map("delivery_proof_photo_url")
  deliveryProofAt        DateTime? @map("delivery_proof_at")
```

Ubicación exacta: en `model Order`, después de `deliveredAt DateTime? @map("delivered_at")` (línea ~339).

- [ ] **Step 2: Generar y aplicar la migración**

Run: `npx prisma migrate dev --name add_order_proof_photos`
Expected: crea `api/prisma/migrations/<timestamp>_add_order_proof_photos/migration.sql` y actualiza el client. Verificar con `npx prisma validate`.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(orders): campos de evidencia fotografica pickup y delivery"
```

---

### Task 2: API — subida + bloqueo obligatorio

**Files:**

- Modify: `api/src/menu/image-upload.service.ts` (suma `uploadProofImage`)
- Modify: `api/src/orders/orders.service.ts` (`uploadProofPhoto` + exigencia en `updateStatus`)
- Modify: `api/src/orders/orders.controller.ts` (nuevo POST + body extendido en PUT)
- Test: `api/src/__tests__/orders.proof-photo.spec.ts`

**Interfaces:**

- Consumes: campos del Task 1; `ImageUploadService.uploadProductImage` como patrón.
- Produces: `POST /orders/:id/proof-photo` (multipart `photo` + `kind`) → `{ url }`; `PUT /orders/:id/status` acepta `{ status, proofPhotoUrl? }`.

- [ ] **Step 1: Escribir el test que falla (bloqueo sin foto)**

```ts
it('picked_up sin foto de pickup se rechaza', async () => {
  prisma.order.findUnique.mockResolvedValue({
    id: 'order-1',
    status: 'in_transit_to_pickup',
    driverId: 'dp-1',
    pickupProofPhotoUrl: null,
    merchant: { userId: 'merchant-user-1' },
    driver: { userId: 'user-d' },
  });
  await expect(service.updateStatus('order-1', 'picked_up', 'user-d')).rejects.toThrow(
    'Subí la foto de evidencia para continuar',
  );
  expect(prisma.order.update).not.toHaveBeenCalled();
});

it('picked_up con foto avanza y sella pickupProofAt', async () => {
  prisma.order.findUnique.mockResolvedValue({
    id: 'order-1',
    status: 'in_transit_to_pickup',
    driverId: 'dp-1',
    pickupProofPhotoUrl: 'https://img/1.jpg',
    merchant: { userId: 'merchant-user-1' },
    driver: { userId: 'user-d' },
  });
  prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'picked_up' });
  await service.updateStatus('order-1', 'picked_up', 'user-d');
  expect(prisma.order.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'order-1' } }),
  );
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx jest api/src/__tests__/orders.proof-photo.spec.ts -v`
Expected: FAIL (no existe el spec / `service.uploadProofPhoto is not a function`).

- [ ] **Step 3: Implementar subida (reutiliza validación, cambia carpeta)**

En `image-upload.service.ts`, agregar junto a `uploadProductImage`:

```ts
async uploadProofImage(file: { buffer: Buffer; size: number; originalname?: string }): Promise<{ url: string }> {
  // Reutiliza TODA la validación (magic bytes, 5MB, configurado).
  // Solo cambia la carpeta de destino a kiwi/proofs.
  const { url } = await this.uploadProductImage(file);
  // uploadProductImage apunta a kiwi/products: re-subir aquí no sirve.
  // Implementación real: copiar el cuerpo de uploadProductImage y cambiar
  // `folder: 'kiwi/products'` por `folder: 'kiwi/proofs'`.
  return { url };
}
```

Nota para el implementador: no llamar a `uploadProductImage` (subiría a products); duplicar su cuerpo de 30 líneas cambiando solo el `folder`. El resto (magic bytes, 5MB, eager 512, errores 400/503) queda idéntico.

- [ ] **Step 4: Implementar `uploadProofPhoto` + bloqueo en `updateStatus`**

En `orders.service.ts`:

```ts
async uploadProofPhoto(orderId: string, kind: 'pickup' | 'delivery', url: string, userId: string) {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId }, include: { merchant: true, driver: true },
  });
  if (!order) throw new NotFoundException('Pedido no encontrado');
  const isMerchantOwner = order.merchant?.userId === userId;
  const isAssignedDriver = order.driver?.userId === userId;
  if (kind === 'pickup' && !isMerchantOwner) throw new ForbiddenException('Solo el comercio sube la foto de entrega al repartidor');
  if (kind === 'delivery' && !isAssignedDriver) throw new ForbiddenException('Solo el repartidor asignado sube la foto de entrega al cliente');
  const data = kind === 'pickup'
    ? { pickupProofPhotoUrl: url, pickupProofAt: new Date() }
    : { deliveryProofPhotoUrl: url, deliveryProofAt: new Date() };
  return this.prisma.order.update({ where: { id: orderId }, data });
}
```

En `updateStatus`, después de `validateStatusActor` y antes de construir `updateData`, insertar:

```ts
if (status === 'picked_up' && !(order as any).pickupProofPhotoUrl) {
  throw new BadRequestException(
    'Subí la foto de evidencia para continuar: el comercio debe fotografiar el pedido al entregarlo.',
  );
}
if (status === 'delivered' && !(order as any).deliveryProofPhotoUrl) {
  throw new BadRequestException(
    'Subí la foto de evidencia para continuar: fotografiá la entrega al cliente.',
  );
}
```

En `orders.controller.ts`, agregar:

```ts
@Post(':id/proof-photo')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024 } }))
@ApiConsumes('multipart/form-data')
async uploadProofPhoto(
  @Param('id') id: string,
  @Body('kind') kind: 'pickup' | 'delivery',
  @UploadedFile() file: any,
  @CurrentUser() user: any,
) {
  return this.ordersService.uploadProofPhotoWithFile(id, kind, file, user.sub);
}
```

`uploadProofPhotoWithFile` valida `kind`, sube vía `imageUpload.uploadProofImage(file)` y llama a `uploadProofPhoto` con la URL. Wiring exacto en `api/src/orders/orders.module.ts` (hoy `ImageUploadService` solo vive en `MenuModule` sin exportarse): agregar el import y el provider así:

```ts
import { ImageUploadService } from '../menu/image-upload.service';
// en @Module:
providers: [OrdersService, ImageUploadService],
```

(`ConfigService`, su única dependencia, ya es global.)

- [ ] **Step 5: Correr tests y lint**

Run: `npx jest api/src/__tests__/orders.proof-photo.spec.ts api/src/__tests__/orders.service.spec.ts -v`
Expected: PASS ambos. Luego `npx tsc --noEmit -p api/tsconfig.json`.

- [ ] **Step 6: Commit**

```bash
git add api/src/orders api/src/menu/image-upload.service.ts api/src/__tests__/orders.proof-photo.spec.ts
git commit -m "feat(orders): foto de evidencia obligatoria pickup y delivery"
```

---

### Task 3: Textos legales (términos, reembolsos, privacidad)

**Files:**

- Modify: `packages/ui/src/legal.ts`
- Test: verificación manual (render `/terms`, `/refunds`, `/privacy` en las 3 apps vía `LegalDocView`)

**Interfaces:**

- Consumes: nada del backend (textos estáticos).
- Produces: sección visible en Términos/Reembolsos/Privacidad.

- [ ] **Step 1: Agregar sección a `termsOfService.sections` (después de `Envíos`)**

```ts
{
  heading: 'Evidencia fotográfica y responsabilidad',
  paragraphs: [
    'Cada pedido lleva 2 fotos obligatorias: el comercio fotografía el pedido al entregarlo al repartidor y el repartidor fotografía la entrega al cliente. Sin foto no se puede avanzar el estado del pedido.',
    'Las fotos son la prueba ante reclamos por daño, faltantes o mal estado: si el pedido salió bien en la foto del comercio y llega dañado, responde el repartidor, no Kiwi ni el comercio. Si no hay foto del comercio, el reclamo se presume a su cargo.',
    'Kiwi es un intermediario tecnológico y no responde por el traslado una vez que el pedido fue entregado al repartidor en buen estado.',
  ],
},
```

Y actualizar `updated` de `termsOfService` a la fecha de hoy (`2026-09-29`).

- [ ] **Step 2: Agregar párrafo a `refundPolicy` (sección `Producto incorrecto, incompleto o en mal estado`)**

Agregar al final de sus `paragraphs`:

```ts
'Los reclamos por daño o faltantes se resuelven contra la evidencia fotográfica: con foto del comercio en buen estado y entrega dañada, el costo lo asume el repartidor; sin foto del comercio, se presume a su cargo.',
```

Actualizar `updated` de `refundPolicy` a `2026-09-29`.

- [ ] **Step 3: Agregar párrafo a `privacyPolicy` (sección `Qué datos recopilamos`)**

```ts
'Fotos de evidencia del pedido: el comercio fotografía el pedido al entregarlo y el repartidor al entregarlo al cliente. Pueden mostrar empaques o etiquetas; se usan solo para soporte y reclamos y se conservan mientras el pedido esté activo y por el plazo contable o legal posterior.',
```

- [ ] **Step 4: Verificar render**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json` y abrir `/terms`, `/refunds`, `/privacy` en web. Expected: las 3 muestran el texto nuevo, sin errores de tipo.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/legal.ts
git commit -m "docs(legal): evidencia fotografica y responsabilidad del repartidor"
```

---

### Task 4: Frontend — captura 1+1 y visualización

**Files:**

- Modify: `packages/ui/src/api-client.ts` (suma método)
- Modify: `apps/web/app/orders/page.tsx` (botón comercio)
- Modify: `apps/driver/app/active/page.tsx` (pasos de foto + bloqueo)
- Modify: `apps/client/app/tracking/[id]/page.tsx`, `apps/web/app/admin/orders/page.tsx` (muestran fotos)
- Test: manual con cámara/archivo + Jest de api-client si existe patrón

**Interfaces:**

- Consumes: `POST /orders/:id/proof-photo` del Task 2.
- Produces: fotos visibles en tracking y admin; avance bloqueado sin foto.

- [ ] **Step 1: Método en `api-client.ts` (junto a `uploadMenuImage`)**

```ts
async uploadOrderProofPhoto(orderId: string, kind: 'pickup' | 'delivery', file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('photo', file);
  fd.append('kind', kind);
  const response = await fetch(`${this.baseUrl}/orders/${orderId}/proof-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
    body: fd,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as any)?.message || `Error al subir foto (${response.status})`);
  }
  return data as { url: string };
}
```

- [ ] **Step 2: Comercio — botón subir foto (web orders)**

En la tarjeta de orden con estado `assigned`/`in_transit_to_pickup`, agregar:

```tsx
<label className="...">
  📷 Subir foto del pedido
  <input
    type="file"
    accept="image/*"
    capture="environment"
    className="hidden"
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await api.uploadOrderProofPhoto(order.id, 'pickup', file);
      await refreshOrders();
    }}
  />
</label>;
{
  !(order as any).pickupProofPhotoUrl && (
    <p className="text-xs text-amber-600">Sin foto no se puede entregar al repartidor.</p>
  );
}
```

- [ ] **Step 3: Driver — bloqueo en `advanceStatus` (active/page.tsx)**

Antes de `await api.updateOrderStatus(order.id, flow.next)`, insertar:

```ts
if (flow.next === 'picked_up' && !(order as any).pickupProofPhotoUrl) {
  setNotice('El comercio debe subir la foto del pedido antes de que lo recojas.');
  return;
}
if (flow.next === 'delivered' && !(order as any).deliveryProofPhotoUrl) {
  // La foto la toma el driver en este paso:
  setNotice('Tomá la foto de la entrega antes de cerrar el pedido.');
  return;
}
```

Y sobre el `TapButton` de avance, cuando el paso sea `picked_up → in_transit_to_delivery` o el final, mostrar input de cámara que sube con `uploadOrderProofPhoto(order.id, 'delivery', file)` y refresca la orden antes de avanzar.

- [ ] **Step 4: Tracking + admin muestran evidencia**

En `tracking/[id]/page.tsx` tras el estado, y en `admin/orders/page.tsx` en el detalle:

```tsx
{
  (order as any).pickupProofPhotoUrl && (
    <img
      src={(order as any).pickupProofPhotoUrl}
      alt="Foto del comercio al entregar"
      className="rounded-xl w-full"
    />
  );
}
{
  (order as any).deliveryProofPhotoUrl && (
    <img
      src={(order as any).deliveryProofPhotoUrl}
      alt="Foto de la entrega al cliente"
      className="rounded-xl w-full"
    />
  );
}
```

El tracking público ya expone la orden vía `getPublicTracking`: verificar que el service incluya los 4 campos (agregar al `select` si los omite).

- [ ] **Step 5: Verificar y commitear**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json` y `npx tsc --noEmit -p apps/driver/tsconfig.json`. Probar manual: comercio sube foto → driver recoge → driver sube foto → entrega. Expected: sin foto el avance da 400/notice; con foto fluye.

```bash
git add packages/ui/src/api-client.ts apps/web/app/orders/page.tsx apps/driver/app/active/page.tsx apps/client/app/tracking/\[id\]/page.tsx apps/web/app/admin/orders/page.tsx
git commit -m "feat(app): captura de evidencia 1+1 comercio y repartidor"
```
