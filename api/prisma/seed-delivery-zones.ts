// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Seed idempotente de zonas de entrega: copia el catálogo en código
 * (NICOYA_DELIVERY_ZONES) a la tabla `delivery_zones` (fuente de verdad del
 * admin). No pisa zonas ya existentes (por label) → seguro re-ejecutar y no
 * pierde ediciones hechas desde el admin.
 *
 * Correr: DATABASE_URL=... npx ts-node prisma/seed-delivery-zones.ts
 */
import { PrismaClient } from '@prisma/client';
import { NICOYA_DELIVERY_ZONES } from '../src/orders/delivery-zones';

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let skipped = 0;
  for (const z of NICOYA_DELIVERY_ZONES) {
    const exists = await prisma.deliveryZone.findFirst({ where: { label: z.label } });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.deliveryZone.create({
      data: {
        label: z.label,
        price: z.price,
        latitude: z.latitude ?? null,
        longitude: z.longitude ?? null,
        geometry: undefined,
        referenceOnly: true,
        active: true,
        sortOrder: 0,
      },
    });
    created++;
  }
  console.log(`🥝 Zonas: ${created} creadas, ${skipped} ya existían.`);
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
