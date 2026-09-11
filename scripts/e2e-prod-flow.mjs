#!/usr/bin/env node
/**
 * End-to-end flow test against the production API.
 *
 * Exercises the real user journey:
 *   1. Merchant login (success, wrong password, profile fetch, auth required)
 *   2. Menu management (list, create, update, delete, ownership + auth guards)
 *   3. Order lifecycle (create -> driver accepts -> transit -> delivered)
 *      plus invalid transitions and access control.
 *
 * Usage:
 *   node scripts/e2e-prod-flow.mjs [baseUrl]
 *
 * Default baseUrl: https://kiwi-api-fe54.onrender.com
 * Credentials default to api/prisma/seed.ts demo data; override via env:
 *   E2E_PASSWORD, E2E_MERCHANT_EMAIL, E2E_DRIVER_EMAIL, E2E_DRIVER2_EMAIL
 */

const BASE = (process.argv[2] || 'https://kiwi-api-fe54.onrender.com').replace(/\/$/, '');
const API = `${BASE}/api`;
const PASSWORD = process.env.E2E_PASSWORD || '123456';
const MERCHANT = process.env.E2E_MERCHANT_EMAIL || 'luis@kiwi.app';
const DRIVER = process.env.E2E_DRIVER_EMAIL || 'juan@kiwi.app';
const DRIVER2 = process.env.E2E_DRIVER2_EMAIL || 'fran@kiwi.app';
const REQUEST_TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS) || 30000;

// Cleanup tracking: a run that dies mid-lifecycle must not leave a LIVE
// order sitting in the driver pool.
let leftoverOrderId = null;
let leftoverOrderDelivered = false;
let leftoverMerchantToken = null;

const results = [];
let step = 0;

function ok(name, pass, detail = '') {
  step++;
  results.push({ n: step, name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${String(step).padStart(2)} ${name}${detail ? ` — ${detail}` : ''}`);
  return pass;
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function main() {
  console.log(`\n🥝 Kiwi E2E flow — ${API}\n` + '─'.repeat(60));

  // ── 1. AUTH ──────────────────────────────────────────────
  console.log('\n👤 1. Merchant login');

  const bad = await req('POST', '/auth/login', { body: { email: MERCHANT, password: 'wrong-password' } });
  ok('wrong password rejected', bad.status === 401, `HTTP ${bad.status}`);

  const noUser = await req('POST', '/auth/login', { body: { email: 'nobody@kiwi.app', password: PASSWORD } });
  ok('unknown email rejected', noUser.status === 401, `HTTP ${noUser.status}`);

  const login = await req('POST', '/auth/login', { body: { email: MERCHANT, password: PASSWORD } });
  const merchantToken = login.data?.accessToken ?? login.data?.access_token;
  ok('merchant login', [200, 201].includes(login.status) && !!merchantToken, `HTTP ${login.status}, token ${merchantToken ? 'received' : 'missing'}`);

  const prof = await req('GET', '/auth/profile', { token: merchantToken });
  ok('profile returns merchant role', prof.status === 200 && prof.data?.role === 'merchant', `role=${prof.data?.role}`);

  const profNoAuth = await req('GET', '/auth/profile');
  ok('profile requires auth', profNoAuth.status === 401, `HTTP ${profNoAuth.status}`);

  // ── 2. MENU MANAGEMENT ───────────────────────────────────
  console.log('\n🍽️  2. Menu management');

  const menuNoAuth = await req('POST', '/menu/my', { body: { name: 'X', price: 1, category: 'Test' } });
  ok('menu create requires auth', menuNoAuth.status === 401, `HTTP ${menuNoAuth.status}`);

  const menuBefore = await req('GET', '/menu/my', { token: merchantToken });
  const beforeCount = Array.isArray(menuBefore.data) ? menuBefore.data.length : -1;
  ok('merchant menu lists items', menuBefore.status === 200 && beforeCount > 0, `${beforeCount} items`);

  const created = await req('POST', '/menu/my', {
    token: merchantToken,
    body: {
      name: 'E2E Test Bowl',
      description: 'Created by e2e-prod-flow.mjs — safe to delete',
      price: 999,
      image: '🧪',
      category: 'E2E Test',
      isAvailable: true,
    },
  });
  const itemId = created.data?.id;
  ok('create menu item', [200, 201].includes(created.status) && !!itemId, `HTTP ${created.status}, id=${itemId}`);

  const updated = await req('PUT', `/menu/my/${itemId}`, {
    token: merchantToken,
    body: { price: 1999, name: 'E2E Test Bowl (updated)' },
  });
  ok('update menu item', [200, 201].includes(updated.status) && Number(updated.data?.price) === 1999,
    `price=${updated.data?.price}`);

  const menuAfter = await req('GET', '/menu/my', { token: merchantToken });
  const visible = Array.isArray(menuAfter.data) && menuAfter.data.some((m) => m.id === itemId);
  ok('new item visible in merchant menu', visible, `${menuAfter.data?.length} items`);

  const missing = await req('PUT', '/menu/my/00000000-0000-4000-8000-000000000000', {
    token: merchantToken,
    body: { price: 1 },
  });
  ok('updating unknown item fails', [403, 404].includes(missing.status), `HTTP ${missing.status} (403 = no existence leak)`);

  const dupCategory = await req('GET', `/menu/my`, { token: merchantToken });
  const inCategory = Array.isArray(dupCategory.data) && dupCategory.data.filter((m) => m.category === 'E2E Test').length;
  ok('item filed under its category', inCategory === 1, `E2E Test category has ${inCategory} item(s)`);

  const del = await req('DELETE', `/menu/my/${itemId}`, { token: merchantToken });
  ok('delete menu item', [200, 204].includes(del.status), `HTTP ${del.status}`);

  const menuFinal = await req('GET', '/menu/my', { token: merchantToken });
  const gone = Array.isArray(menuFinal.data) && !menuFinal.data.some((m) => m.id === itemId);
  ok('item removed from menu', gone, `${menuFinal.data?.length} items remain`);

  // ── 3. ORDER LIFECYCLE ───────────────────────────────────
  console.log('\n📦 3. Order lifecycle (merchant creates, driver delivers)');

  const orderNoAuth = await req('POST', '/orders', { body: { pickupAddress: 'x' } });
  ok('order create requires auth', orderNoAuth.status === 401, `HTTP ${orderNoAuth.status}`);

  const newOrder = await req('POST', '/orders', {
    token: merchantToken,
    body: {
      pickupAddress: 'Bowl & Café Luis Alfredo, Nicoya Centro',
      deliveryAddress: 'E2E TEST — Barrio Los Ángeles, casa naranja',
      deliveryLat: 10.15,
      deliveryLng: -85.45,
      distanceKm: 1.5,
      orderType: 'immediate',
      specialInstructions: 'Pedido de prueba E2E automatizado',
    },
  });
  const orderId = newOrder.data?.id;
  leftoverOrderId = orderId || null;
  leftoverMerchantToken = merchantToken;
  ok('merchant creates order', [200, 201].includes(newOrder.status) && !!orderId,
    `status=${newOrder.data?.status}, basePrice=${newOrder.data?.basePrice}`);

  ok('new order starts pending', newOrder.data?.status === 'pending');
  ok('pricing computed by distance (1.5km → ₡1000)', Number(newOrder.data?.basePrice) === 1000, `basePrice=${newOrder.data?.basePrice}`);

  const myOrders = await req('GET', '/orders/my', { token: merchantToken });
  ok('order appears in merchant order list', myOrders.status === 200 && myOrders.data?.some?.((o) => o.id === orderId),
    `${myOrders.data?.length} total orders`);

  // Driver side
  const dLogin = await req('POST', '/auth/login', { body: { email: DRIVER, password: PASSWORD } });
  const driverToken = dLogin.data?.accessToken ?? dLogin.data?.access_token;
  ok('driver login', [200, 201].includes(dLogin.status) && !!driverToken);

  const available = await req('GET', '/orders/available', { token: driverToken });
  ok('order visible to available drivers', available.status === 200 && available.data?.some?.((o) => o.id === orderId),
    `${available.data?.length} pending orders`);

  const accepted = await req('POST', `/orders/${orderId}/accept`, { token: driverToken });
  ok('driver accepts order', [200, 201].includes(accepted.status) && accepted.data?.status === 'assigned',
    `status=${accepted.data?.status}`);

  const doubleAccept = await req('POST', `/orders/${orderId}/accept`, { token: driverToken });
  ok('double-accept rejected', doubleAccept.status === 400, `HTTP ${doubleAccept.status}`);

  const asMerchant = await req('GET', `/orders/${orderId}`, { token: merchantToken });
  ok('merchant sees assigned driver', asMerchant.status === 200 && !!asMerchant.data?.driver, 
    `driver=${asMerchant.data?.driver?.fullName ?? asMerchant.data?.driver?.userId ?? 'set'}`);

  // Access control: a different driver must not see this order
  const d2Login = await req('POST', '/auth/login', { body: { email: DRIVER2, password: PASSWORD } });
  const outsider = await req('GET', `/orders/${orderId}`, { token: d2Login.data?.accessToken ?? d2Login.data?.access_token });
  ok('other driver denied access to order', outsider.status === 403, `HTTP ${outsider.status}`);

  // Status walk
  const walk = async (status) => {
    const r = await req('PUT', `/orders/${orderId}/status`, { token: driverToken, body: { status } });
    return ok(`status → ${status}`, r.status === 200 && r.data?.status === status, `HTTP ${r.status}`);
  };
  await walk('in_transit_to_pickup');
  await walk('picked_up');
  await walk('in_transit_to_delivery');
  await walk('delivered');

  const delivered = await req('GET', `/orders/${orderId}`, { token: merchantToken });
  ok('deliveredAt timestamp set', !!delivered.data?.deliveredAt, `deliveredAt=${delivered.data?.deliveredAt}`);
  if (delivered.data?.status === 'delivered') leftoverOrderDelivered = true;

  const invalid = await req('PUT', `/orders/${orderId}/status`, { token: driverToken, body: { status: 'pending' } });
  ok('invalid transition (delivered → pending) rejected', invalid.status === 400, `HTTP ${invalid.status}`);

  // ── Cleanup ────────────────────────────────────────────
  // Delivered orders have no delete endpoint: the test order stays as a
  // historical record (marked "E2E TEST"). But an order that never got
  // delivered (failed run) must be cancelled so it doesn't sit LIVE in
  // the driver pool.
  if (leftoverOrderId && !leftoverOrderDelivered && leftoverMerchantToken) {
    try {
      const cancel = await req('PUT', `/orders/${leftoverOrderId}/status`, {
        token: leftoverMerchantToken,
        body: { status: 'cancelled' },
      });
      console.log(`\n🧹 Leftover order ${cancel.status === 200 ? 'cancelled' : `NOT cancelled (HTTP ${cancel.status})`} (${leftoverOrderId})`);
    } catch (e) {
      console.log(`\n🧹 Could not cancel leftover order ${leftoverOrderId}: ${e.message}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────
  const failed = results.filter((r) => !r.pass);
  console.log('\n' + '─'.repeat(60));
  console.log(`📊 ${results.length - failed.length}/${results.length} steps passed${failed.length ? ` — ${failed.length} FAILED` : ' — all green ✅'}`);
  if (failed.length) {
    console.log('\nFailed steps:');
    for (const f of failed) console.log(`   ❌ ${f.name} ${f.detail}`);
  }
  console.log(`\nℹ️  Left behind: one delivered test order (${orderId}) marked "E2E TEST" in deliveryAddress (no delete endpoint — historical record).`);
  console.log(`   Merchant menu was restored (test item created and deleted).`);

  if (failed.length) process.exit(1);
}

main().catch(async (e) => {
  console.error(`\n❌ E2E run crashed: ${e.message}`);
  if (leftoverOrderId && !leftoverOrderDelivered && leftoverMerchantToken) {
    try {
      await req('PUT', `/orders/${leftoverOrderId}/status`, {
        token: leftoverMerchantToken,
        body: { status: 'cancelled' },
      });
      console.log(`🧹 Leftover order cancelled (${leftoverOrderId})`);
    } catch {
      console.log(`🧹 Could not cancel leftover order ${leftoverOrderId}`);
    }
  }
  process.exit(2);
});
