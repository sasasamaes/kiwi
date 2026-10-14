// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
// Carga el producto "Crea tu Bowl" + grupos/opciones de KyL Bowls.
// Uso:  cd api && DATABASE_URL="<EXTERNAL_URL de Render>" node prisma/seed-kyl-bowl.mjs
// Es idempotente: si el producto ya existe, lo actualiza (grupos se recrean).
// Por seguridad ABORTA si el comercio no se llama KyL.

import { PrismaClient } from '@prisma/client';

const MERCHANT_ID = '93d3a1f4-2102-4eb8-9076-1b04ad5eb46f';
const ITEM_NAME = 'Crea tu Bowl';

const GROUPS = [
  {
    name: 'Tamaño',
    required: true,
    multiple: false,
    maxSelections: null,
    options: [
      { name: 'Pequeño (12 oz)', priceDelta: 0 },
      { name: 'Mediano (16 oz)', priceDelta: 600 },
      { name: 'Grande (24 oz)', priceDelta: 2100 },
    ],
  },
  {
    name: 'Base',
    required: true,
    multiple: false,
    maxSelections: null,
    options: [
      { name: 'Açaí', priceDelta: 300 },
      { name: 'Fresa', priceDelta: 0 },
      { name: 'Maracuyá', priceDelta: 0 },
      { name: 'Mora', priceDelta: 0 },
      { name: 'Mango', priceDelta: 0 },
      { name: 'Frutos rojos', priceDelta: 300 },
      { name: 'Pitahaya', priceDelta: 0 },
    ],
  },
  {
    name: 'Frutas (3 incluidas)',
    required: true,
    multiple: true,
    maxSelections: 3,
    options: [
      'Banano',
      'Fresa',
      'Sandía',
      'Uva',
      'Piña',
      'Papaya',
      'Mango',
      'Manzana verde',
      'Kiwi',
    ].map((name) => ({ name, priceDelta: 0 })),
  },
  {
    name: 'Toppings (3 incluidos)',
    required: true,
    multiple: true,
    maxSelections: 3,
    options: [
      "Hershey's caramelo",
      "Hershey's chocolate",
      'Leche condensada',
      'Mantequilla de maní',
      'Bolitas de chocolate',
      'Bolitas de chocolate blanco',
      'Chispas de chocolate semiamargo',
      'Maní',
      'Granola',
      'Nutella',
      'Coco',
      'Chía',
      'Almendras',
      'Miel de abeja',
      'Semillas de girasol',
    ].map((name) => ({ name, priceDelta: 0 })),
  },
  {
    name: 'Extras',
    required: false,
    multiple: true,
    maxSelections: null,
    options: [
      { name: 'Arándanos', priceDelta: 600 },
      { name: 'Helado', priceDelta: 800 },
      { name: 'Yogurt', priceDelta: 600 },
      { name: 'Semillas de marañón', priceDelta: 650 },
      { name: 'Nutella', priceDelta: 650 },
      { name: '1 topping extra', priceDelta: 500 },
      { name: '1 fruta extra', priceDelta: 500 },
    ],
  },
];

const prisma = new PrismaClient();

try {
  const merchant = await prisma.merchantProfile.findUnique({
    where: { id: MERCHANT_ID },
    select: { id: true, businessName: true },
  });
  if (!merchant) {
    console.error(`❌ No existe merchantProfile ${MERCHANT_ID} en esta DB.`);
    process.exit(1);
  }
  if (!/kyl/i.test(merchant.businessName ?? '')) {
    console.error(`❌ Seguridad: el comercio es "${merchant.businessName}", no KyL. Abortado.`);
    process.exit(1);
  }
  console.log(`✅ Comercio: ${merchant.businessName} (${merchant.id})`);

  const existing = await prisma.menuItem.findFirst({
    where: { merchantId: MERCHANT_ID, name: ITEM_NAME },
    select: { id: true },
  });

  const lastInCategory = await prisma.menuItem.findFirst({
    where: { merchantId: MERCHANT_ID, category: 'Bowls' },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  let itemId;
  if (existing) {
    await prisma.menuItem.update({
      where: { id: existing.id },
      data: {
        description: 'Elegí tamaño, base, 3 frutas, 3 toppings y agregá extras',
        price: 2900,
        category: 'Bowls',
        isAvailable: true,
      },
    });
    await prisma.menuItemVariantGroup.deleteMany({ where: { menuItemId: existing.id } });
    itemId = existing.id;
    console.log(`♻️  Producto existente actualizado (${itemId}), grupos recreados.`);
  } else {
    const created = await prisma.menuItem.create({
      data: {
        merchantId: MERCHANT_ID,
        name: ITEM_NAME,
        description: 'Elegí tamaño, base, 3 frutas, 3 toppings y agregá extras',
        price: 2900,
        category: 'Bowls',
        isPopular: false,
        isAvailable: true,
        sortOrder: (lastInCategory?.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });
    itemId = created.id;
    console.log(`➕ Producto creado (${itemId}).`);
  }

  for (const [gi, g] of GROUPS.entries()) {
    const group = await prisma.menuItemVariantGroup.create({
      data: {
        menuItemId: itemId,
        name: g.name,
        required: g.required,
        multiple: g.multiple,
        maxSelections: g.maxSelections,
        sortOrder: gi,
      },
      select: { id: true },
    });
    await prisma.menuItemVariantOption.createMany({
      data: g.options.map((o, oi) => ({
        groupId: group.id,
        name: o.name,
        priceDelta: o.priceDelta,
        sortOrder: oi,
        isAvailable: true,
      })),
    });
    console.log(`   • ${g.name}: ${g.options.length} opciones`);
  }

  console.log('🎉 Listo. Verificá en https://www.kiwicr.express/menu/' + MERCHANT_ID);
} finally {
  await prisma.$disconnect();
}
