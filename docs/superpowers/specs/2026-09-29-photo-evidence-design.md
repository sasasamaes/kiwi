# Evidencia fotográfica del pedido — Design

Fecha: 2026-09-29 · Estado: aprobado por el dueño · Alcance: A+B

## Problema

Hoy no hay prueba del estado del pedido al momento del traspaso. Si llega
dañado o incompleto, no se puede saber si falló el comercio, el repartidor
o Kiwi. Se necesita evidencia y una regla de responsabilidad clara.

## Decisiones del dueño

- 1 foto del comercio al entregar el pedido al repartidor (prueba de buen estado).
- 1 foto del repartidor al entregar el pedido al cliente.
- Ambas fotos obligatorias: sin foto no se puede avanzar el estado.
- Las fotos son la prueba ante reclamos: si el pedido salió bien en la foto
  del comercio y llega dañado, responde el repartidor, no Kiwi ni el comercio.

## Backend (API + DB)

- `Order` suma: `pickupProofPhotoUrl` + `pickupProofAt`,
  `deliveryProofPhotoUrl` + `deliveryProofAt` (migración Prisma).
- Nuevo `POST /orders/:id/proof-photo` multipart con `kind: pickup|delivery`.
  Reutiliza la validación estricta de `ImageUploadService` (magic bytes,
  máx 5 MB, JPG/PNG/WEBP/GIF) con carpeta `kiwi/proofs`.
  Roles: `merchant` dueño sube `pickup`, `driver` asignado sube `delivery`.
- `PUT /orders/:id/status` exige evidencia:
  `in_transit_to_pickup → picked_up` requiere `pickupProofPhotoUrl`,
  `in_transit_to_delivery → delivered` requiere `deliveryProofPhotoUrl`
  (400 si falta). Se acepta foto pre-cargada en el mismo flujo.
- Tracking público (`getPublicTracking`) y vistas de admin exponen las URLs
  como evidencia (sin datos de contacto).

## Frontend

- Panel comercio (web): en la orden lista, botón "Subir foto del pedido"
  (cámara/archivo). Sin foto, el botón de entregar al repartidor queda
  bloqueado con mensaje.
- App repartidor (driver/active): paso "Tomar foto al recoger" y
  "Tomar foto al entregar" con input de cámara. Sin foto, el avance
  (`Recogí el pedido` / `Entregué el pedido`) queda bloqueado con mensaje.
- Tracking público + admin/merchant muestran las 2 fotos como evidencia.
- Fuera de alcance (fase C): cola offline de fotos, doble confirmación del
  cliente, retención automática.

## Legal (`packages/ui/src/legal.ts`)

- Términos → nueva sección "Evidencia fotográfica y responsabilidad":
  fotos obligatorias, bloqueo de avance sin foto, valor probatorio,
  regla de responsabilidad (daño post-foto del comercio = repartidor),
  Kiwi como intermediario no responde por el traslado.
- Reembolsos → el reclamo por daño se resuelve contra la evidencia:
  sin foto de entrega del comercio, se presume a su cargo; con foto OK
  y entrega dañada, a cargo del repartidor.
- Privacidad → las fotos del pedido pueden mostrar empaques/etiquetas;
  se conservan para soporte y reclamos mientras el pedido esté activo
  y por el plazo contable/legal posterior.

## Errores y testing

- Subida inválida (formato/peso) → 400/413 con mensaje en español;
  Cloudinary caído → 503 sin bloquear el resto de la app.
- Avance sin foto → 400 "Subí la foto de evidencia para continuar".
- Tests: transición bloqueada sin foto, permitida con foto, roles
  (comercio solo pickup, driver solo delivery), tracking expone fotos sin teléfonos.
