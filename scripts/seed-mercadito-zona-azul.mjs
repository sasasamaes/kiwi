#!/usr/bin/env node
// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Alta del "Mercadito Zona Azul" en un comercio existente.
 *
 * Crea/actualiza los productos (categoría "Mercadito Zona Azul") del comercio
 * dueño. Idempotente-básico: si ya existe un item con el mismo nombre en la
 * categoría, lo actualiza en vez de duplicarlo.
 *
 * Uso:
 *   API_URL=https://api.kiwicr.express/api \
 *   E2E_MERCHANT_EMAIL=tu-correo E2E_PASSWORD=tu-clave \
 *   node scripts/seed-mercadito-zona-azul.mjs
 *
 * Imprime el merchantId para setear NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID.
 */

const API = (process.env.API_URL || 'http://localhost:4100/api').replace(/\/$/, '');
const EMAIL = process.env.E2E_MERCHANT_EMAIL || process.env.MERCHANT_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD || process.env.MERCHANT_PASSWORD;

const CATEGORY = 'Mercadito Zona Azul';

const ITEMS = [
  {
    name: 'Cuajada con leche de Nicoya — Par (2 unidades)',
    price: 2000,
    category: CATEGORY,
    stockQty: 60,
    isAvailable: true,
    image: '🧀',
    description:
      'Cuajada artesanal con leche, hecha por productoras de Nicoya — una de las 5 Zonas Azules del mundo. Se vende por par: 2 unidades por ₡2000.',
  },
  // Cuando hables con la señora de las tortillas, descomentá y volvé a correr:
  // {
  //   name: 'Tortillas de maíz de la zona — Paquete',
  //   price: 0, // TODO: precio
  //   category: CATEGORY,
  //   stockQty: 0, // TODO: stock
  //   isAvailable: false,
  //   image: '🌽',
  //   description: 'Tortillas hechas a mano con maíz de la zona de Nicoya.',
  // },
];

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-json */
  }
  return { status: res.status, data };
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('❌ Faltan E2E_MERCHANT_EMAIL y E2E_PASSWORD en el entorno.');
    process.exit(1);
  }
  console.log(`🥝 Mercadito Zona Azul → ${API}`);

  const login = await req('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const token = login.data?.accessToken ?? login.data?.access_token;
  if (!token) {
    console.error(`❌ Login falló (HTTP ${login.status}). Revisá el correo/clave.`);
    process.exit(1);
  }

  const me = await req('GET', '/merchants/me', { token });
  if (!me.data?.id) {
    console.error(
      `❌ El correo ${EMAIL} no tiene perfil de comercio (HTTP ${me.status}). Registrá el negocio primero.`,
    );
    process.exit(1);
  }
  const merchantId = me.data.id;
  console.log(`🏪 Comercio: ${me.data.businessName ?? '(sin nombre)'} (${merchantId})`);

  const menu = await req('GET', '/menu/my', { token });
  const existing = Array.isArray(menu.data) ? menu.data : [];

  for (const item of ITEMS) {
    const found = existing.find((m) => m.category === CATEGORY && m.name === item.name);
    if (found) {
      const upd = await req('PUT', `/menu/my/${found.id}`, { token, body: item });
      console.log(`♻️  Actualizado: ${item.name} (HTTP ${upd.status})`);
    } else {
      const created = await req('POST', '/menu/my', { token, body: item });
      console.log(`➕ Creado: ${item.name} (HTTP ${created.status})`);
    }
  }

  console.log('\n✅ Listo. Seteá en Vercel (apps/client):');
  console.log(`   NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID=${merchantId}`);
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
