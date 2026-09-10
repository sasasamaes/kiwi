# Spec: Pedido dual Comida/Encomienda con asignación y nuevo pricing

Fecha: 2026-09-10 · Estado: aprobada por el dueño · Fase 1 de la estrategia (conectar comercios con repartidores; menú QR / app express quedan para fase 2)

## 1. Objetivo

El comercio crea pedidos en `/orders/new` en dos modos: **Comida** (con ítems) y **Encomienda** (flete de mercancía, sin productos). Al pagar se cobra viaje ₡2000 (zona Nicoya centro, 10 km) + comisión 10% del viaje. Los productos pasan al 100% para el comercio (0% comisión por ahora).

## 2. Modelo de precio (fuente de verdad: backend)

- `tripPrice`: zona Nicoya centro → ₡2000 plano; fuera de zona → tabla por distancia vigente.
- `commission = round(tripPrice * 0.10)` — 10% **del viaje**, siempre. Reemplaza el 5% descontado actual.
- `productsTotal`: suma enviada por el comercio (solo modo Comida), validada `>= 0`. Comisión 0% sobre productos, aislada en `commissionForProducts()` para que fase 2 sea cambiar una función.
- `totalAmount = productsTotal + tripPrice + commission`.
- `driverPayout = tripPrice` (el repartidor recibe el viaje íntegro).
- El frontend muestra estimado con la misma fórmula; el backend recalcula y manda.

Ejemplo zona, solo flete: viaje 2000 + comisión 200 = **₡2200** (driver: 2000). Con productos de 5000: 5000 + 2000 + 200 = **₡7200**.

## 3. Modo Comida

- Rápidos desde el menú real del comercio (`GET /menu/my`), reemplaza el hardcode actual. Fallback a personalizado si el menú está vacío.
- Formulario personalizado existente (nombre + cantidad + precio). Requiere ≥ 1 ítem para avanzar (validación actual se mantiene).

## 4. Modo Encomienda

- Selector de modo en pantalla inicial del wizard (nuevo paso previo a Recoger; default: Comida).
- Sin ítems. Campos: descripción del paquete (obligatoria), tamaño S/M/L (informativo para el driver, no afecta precio), valor declarado (opcional, informativo), instrucciones (reusa el campo actual).
- `productsTotal = 0`. El paso 3 muestra resumen del paquete en vez de lista de productos.

## 5. Asignación triple de repartidor

Paso final "¿Quién lo lleva?" (ambos modos):

1. **Favoritos** primero: `GET /merchants/me/favorites` + estrella para agregar/quitar (`POST/DELETE /merchants/me/favorites/:id`). Endpoints ya existen, solo falta UI.
2. **Disponibles**: `GET /drivers/available` (con coords de pickup si hay).
3. **Asignar después**: crea el pedido pendiente, se asigna en Repartidores como hoy.

- Crear con driver elegido llama a `PUT /orders/:id/assign` tras el create (o el backend acepta `driverId` en el create; decisión de implementación: dos llamadas desde el frontend, sin cambio de API).

## 6. Pago

- Desglose visible: Viaje + Comisión Kiwi (10%) + Productos (si hay) = Total. Mismos métodos (sinpe/card/cash).
- Sin cambios al flujo de cobro, solo los montos que ya vienen del backend.

## 7. Alcance explícito (no incluye)

- Comisión sobre productos (fase 2, con menú QR / app express).
- Precio por tamaño de paquete ni recargo fuera de zona distinto del actual.
- Nuevo endpoint de listado de comercios (pendiente aparte).
- Cambios al socket ni a notificaciones.

## 8. Testing

- Specs backend: flete en zona = 200/2000/2200; con productos suma pass-through; fuera de zona usa tabla + 10%; `productsTotal` negativo → 400.
- Type-check + build de `api` y `web`. Verificación manual del wizard en ambos modos + asignar favorito/disponible/después.
