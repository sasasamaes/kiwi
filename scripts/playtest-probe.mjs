#!/usr/bin/env node
/**
 * THROWAWAY playtest probe — deleted after the session.
 * Boots the real API + both Next dev servers in THIS process tree
 * (background processes do not survive between terminal calls here),
 * then drives the real surfaces over HTTP with careless variants.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const API = 'http://localhost:4000/api';
const PASSWORD = '123456';
const MERCHANT = 'luis@kiwi.app';
const MERCHANT2 = 'ana@test.com'; // second merchant ( outsider probes )
const DRIVER = 'juan@kiwi.app';
const DRIVER2 = 'fran@kiwi.app';

const defects = [];
let n = 0;
function defect(area, what, detail) {
  n++;
  defects.push({ area, what, detail });
  console.log(`❌ [${area}] ${what}${detail ? ` — ${detail}` : ''}`);
}
function fine(area, what, detail = '') {
  console.log(`✅ [${area}] ${what}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, path, { token, body, raw } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(raw !== undefined ? { body: raw } : body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

async function waitHttp(url, tries = 60, label = '') {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return r.status;
    } catch {}
    await sleep(1000);
  }
  throw new Error(`timeout waiting for ${label || url}`);
}

const children = [];
import { openSync } from 'node:fs';
function boot(cmd, args, opts, logFile) {
  const out = { logs: '' };
  const fd = openSync(logFile, 'a');
  const p = spawn(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...opts.env }, stdio: ['ignore', fd, fd] });
  p.on('exit', (code, sig) => console.log(`   ⚠️ child ${cmd} ${args.join(' ')} exited code=${code} sig=${sig}`));
  children.push(p);
  return out;
}

async function main() {
  const root = process.cwd();
  console.log('🚀 booting API (4000), web (3000), driver (3001)… from', root);
  boot('node', ['dist/main.js'], { cwd: `${root}/api`, env: { PORT: '4000' } }, '/tmp/pt-api.log');
  boot('npm', ['run', 'dev'], { cwd: `${root}/apps/web` }, '/tmp/pt-web.log');
  boot('npm', ['run', 'dev'], { cwd: `${root}/apps/driver` }, '/tmp/pt-driver.log');

  await waitHttp(`${API}/payments/methods`, 90, 'api');
  console.log('✅ api up');
  await waitHttp('http://localhost:3000/', 120, 'web');
  console.log('✅ web up');
  await waitHttp('http://localhost:3001/', 120, 'driver');
  console.log('✅ driver up');

  // tokens
  const mTok = (await req('POST', '/auth/login', { body: { email: MERCHANT, password: PASSWORD } })).data?.accessToken;
  const m2Tok = (await req('POST', '/auth/login', { body: { email: MERCHANT2, password: PASSWORD } })).data?.accessToken;
  const dTok = (await req('POST', '/auth/login', { body: { email: DRIVER, password: PASSWORD } })).data?.accessToken;
  const d2Tok = (await req('POST', '/auth/login', { body: { email: DRIVER2, password: PASSWORD } })).data?.accessToken;
  if (!mTok || !dTok || !d2Tok || !m2Tok) throw new Error('could not get tokens');

  // ══ A. AUTH — careless variants ══
  console.log('\n── A. auth carelessness ──');
  {
    let r = await req('POST', '/auth/login', { raw: '{bad json' });
    r.status === 400 ? fine('auth', 'malformed JSON → 400') : defect('auth', `malformed JSON → ${r.status}`, 'expected 400');
    r = await req('POST', '/auth/login', { body: { password: PASSWORD } });
    [400, 401].includes(r.status) ? fine('auth', 'missing email rejected', `HTTP ${r.status}`) : defect('auth', `missing email → ${r.status}`);
    r = await req('POST', '/auth/login', { body: { email: 'not-an-email', password: PASSWORD } });
    [400, 401].includes(r.status) ? fine('auth', 'invalid email format rejected', `HTTP ${r.status}`) : defect('auth', `invalid email format → ${r.status}`);
    r = await req('POST', '/auth/register', { body: { email: MERCHANT, password: PASSWORD, fullName: 'Dup' } });
    r.status === 409 ? fine('auth', 'duplicate register → 409') : defect('auth', `duplicate register → ${r.status}`, JSON.stringify(r.data)?.slice(0, 120));
    r = await req('POST', '/auth/register', { body: { email: 'x@y.z', password: '123', fullName: 'Shorty' } });
    [400, 409].includes(r.status) ? fine('auth', 'short password rejected', `HTTP ${r.status}`) : defect('auth', `short password accepted → ${r.status}`);
  }

  // ══ B. MENU — careless variants ══
  console.log('\n── B. menu carelessness ──');
  {
    const cases = [
      ['negative price', { name: 'Neg', price: -5, category: 'T' }],
      ['zero price', { name: 'Zero', price: 0, category: 'T' }],
      ['empty name', { name: '', price: 5, category: 'T' }],
      ['string price', { name: 'Str', price: 'diez', category: 'T' }],
      ['no category', { name: 'NoCat', price: 5 }],
      ['huge price', { name: 'Huge', price: 99999999999, category: 'T' }],
      ['float price 10.555', { name: 'Float', price: 10.555, category: 'T' }],
      ['xss name', { name: '<script>alert(1)</script>', price: 5, category: 'T' }],
    ];
    for (const [label, body] of cases) {
      const r = await req('POST', '/menu/my', { token: mTok, body });
      if (r.status < 300) {
        const v = Number(r.data?.price);
        if (label === 'float price 10.555' && Math.abs(v - 10.56) < 0.001) {
          fine('menu', `float price rounded`, `price=${v}`);
        } else if (label === 'xss name' && r.data?.name === '<script>alert(1)</script>') {
          fine('menu', 'xss stored raw (frontend must escape)', 'noting, not a server bug per se');
        } else if (label === 'string price') {
          defect('menu', `string price ACCEPTED`, `price=${JSON.stringify(r.data?.price)}`);
        } else {
          fine('menu', `${label} accepted`, `HTTP ${r.status} price=${r.data?.price}`);
        }
        await req('DELETE', `/menu/my/${r.data.id}`, { token: mTok });
      } else {
        fine('menu', `${label} rejected`, `HTTP ${r.status}`);
      }
    }
    // outsider touching my item
    const mine = await req('POST', '/menu/my', { token: mTok, body: { name: 'OutsiderBait', price: 5, category: 'T' } });
    const r2 = await req('PUT', `/menu/my/${mine.data.id}`, { token: m2Tok, body: { price: 1 } });
    [403, 404].includes(r2.status) ? fine('menu', 'outsider update rejected', `HTTP ${r2.status}`) : defect('menu', `outsider update → ${r2.status}`);
    const r3 = await req('DELETE', `/menu/my/${mine.data.id}`, { token: m2Tok });
    [403, 404].includes(r3.status) ? fine('menu', 'outsider delete rejected', `HTTP ${r3.status}`) : defect('menu', `outsider delete → ${r3.status}`);
    await req('DELETE', `/menu/my/${mine.data.id}`, { token: mTok });
  }

  // ══ C. ORDERS — freight + careless ══
  console.log('\n── C. orders carelessness ──');
  const freightIds = [];
  {
    // freight weight edges
    for (const [label, weightKg] of [['zero', 0], ['negative', -5], ['huge', 501], ['string', 'abc'], ['valid 12.5', 12.5]]) {
      const r = await req('POST', '/orders', {
        token: mTok,
        body: {
          pickupAddress: 'Playtest Pickup',
          deliveryAddress: 'Playtest Drop',
          distanceKm: 3,
          orderType: 'immediate',
          kind: 'freight',
          weightKg,
        },
      });
      if (r.status < 300) {
        const id = r.data?.id;
        freightIds.push(id);
        const expectSurcharge = typeof weightKg === 'number' && weightKg > 5 ? 2000 + Math.ceil(weightKg - 5) * 500 : 2000;
        const dp = Number(r.data?.driverPayout);
        Math.abs(dp - expectSurcharge) < 0.01
          ? fine('orders', `freight weight ${label} priced right`, `driverPayout=${dp}`)
          : defect('orders', `freight weight ${label} pricing wrong`, `driverPayout=${dp} expected=${expectSurcharge}`);
        if (label === 'string') defect('orders', `string weightKg ACCEPTED`, `weightKg=${r.data?.weightKg}`);
      } else {
        fine('orders', `freight weight ${label} rejected`, `HTTP ${r.status}`);
      }
    }
    // careless creates
    const c1 = await req('POST', '/orders', { token: mTok, body: { pickupAddress: '', deliveryAddress: '', distanceKm: -9, orderType: 'immediate' } });
    c1.status >= 400 ? fine('orders', 'empty addresses + negative km rejected', `HTTP ${c1.status}`) : defect('orders', `empty addresses accepted → ${c1.status}`, `dist=${c1.data?.distanceKm}`);
    const c2 = await req('POST', '/orders', { token: mTok, body: { pickupAddress: 'A', deliveryAddress: 'B', distanceKm: 99999, orderType: 'immediate' } });
    c2.status < 300 ? fine('orders', 'huge distance accepted (noting pricing)', `basePrice=${c2.data?.basePrice}`) : fine('orders', 'huge distance rejected', `HTTP ${c2.status}`);
    if (c2.data?.id) freightIds.push(c2.data.id);
    const c3 = await req('POST', '/orders', { token: mTok, body: { pickupAddress: 'A', deliveryAddress: 'B', distanceKm: 2, orderType: 'scheduled', scheduledDate: '2020-01-01' } });
    c3.status >= 400 ? fine('orders', 'past scheduled date rejected', `HTTP ${c3.status}`) : defect('orders', `past scheduled date accepted → ${c3.status}`, c3.data?.id);
    if (c3.data?.id) freightIds.push(c3.data.id);
    // items carelessness
    const c4 = await req('POST', '/orders', {
      token: mTok,
      body: { pickupAddress: 'A', deliveryAddress: 'B', distanceKm: 2, orderType: 'immediate', items: [{ name: 'Ghost', price: 0, quantity: -3 }] },
    });
    c4.status < 300 ? fine('orders', 'negative quantity item accepted (noting)', `items=${JSON.stringify(c4.data?.items)?.slice(0, 80)}`) : fine('orders', 'negative quantity rejected', `HTTP ${c4.status}`);
    if (c4.data?.id) freightIds.push(c4.data.id);
    const c5 = await req('POST', '/orders', {
      token: mTok,
      body: { pickupAddress: 'A', deliveryAddress: 'B', distanceKm: 2, orderType: 'immediate', items: [{ menuItemId: '00000000-0000-4000-8000-000000000000', quantity: 1 }] },
    });
    c5.status >= 400 ? fine('orders', 'unknown menuItemId rejected', `HTTP ${c5.status}`) : defect('orders', `unknown menuItemId accepted → ${c5.status}`, c5.data?.id);
    if (c5.data?.id) freightIds.push(c5.data.id);
    // rapid double-create (careless double tap)
    const burst = await Promise.all(
      Array.from({ length: 5 }, () =>
        req('POST', '/orders', { token: mTok, body: { pickupAddress: 'RapidPick', deliveryAddress: 'RapidDrop', distanceKm: 1, orderType: 'immediate' } }),
      ),
    );
    const created = burst.filter((r) => r.status < 300);
    created.length === 5 ? fine('orders', '5 rapid creates → 5 orders (user asked for it 5x)', 'acceptable UX behavior') : fine('orders', `rapid creates → ${created.length} orders`, 'dedup happened?');
    created.forEach((r) => freightIds.push(r.data.id));
  }

  // accept race: two drivers accept same order simultaneously
  console.log('\n── C2. accept race (two drivers, one order) ──');
  {
    const raceOrder = freightIds.find(Boolean);
    const [a, b] = await Promise.all([
      req('POST', `/orders/${raceOrder}/accept`, { token: dTok }),
      req('POST', `/orders/${raceOrder}/accept`, { token: d2Tok }),
    ]);
    const wins = [a, b].filter((r) => r.status < 300);
    wins.length === 1
      ? fine('race', `double-accept → exactly 1 winner`, `a=${a.status} b=${b.status}`)
      : defect('race', `double-accept winners=${wins.length}`, `a=${a.status} b=${b.status}`);
    // walk it to delivered for ratings tests
    for (const s of ['in_transit_to_pickup', 'picked_up', 'in_transit_to_delivery', 'delivered']) {
      await req('PUT', `/orders/${raceOrder}/status`, { token: dTok, body: { status: s } });
    }
    console.log(`   (order ${raceOrder} walked to delivered)`);
  }

  // ══ D. RATINGS — careless ══
  console.log('\n── D. ratings carelessness ──');
  {
    const deliveredOrder = freightIds.find(Boolean);
    // find a fresh delivered order? use the raced one
    const checks = [
      ['0 stars', { orderId: deliveredOrder, rating: 0 }, [400, 403]],
      ['6 stars', { orderId: deliveredOrder, rating: 6 }, [400, 403]],
      ['float 4.5 stars', { orderId: deliveredOrder, rating: 4.5 }, [400, 403]],
      ['missing rating', { orderId: deliveredOrder }, [400, 403]],
    ];
    for (const [label, body, expected] of checks) {
      const r = await req('POST', '/ratings', { token: mTok, body });
      expected.includes(r.status) ? fine('ratings', `${label} rejected`, `HTTP ${r.status}`) : defect('ratings', `${label} → ${r.status}`, JSON.stringify(r.data)?.slice(0, 100));
    }
    // driver rates own order → forbidden (only merchant rates)
    const rOwn = await req('POST', '/ratings', { token: dTok, body: { orderId: deliveredOrder, rating: 5 } });
    [400, 403].includes(rOwn.status) ? fine('ratings', 'driver cannot rate', `HTTP ${rOwn.status}`) : defect('ratings', `driver rating → ${rOwn.status}`);
    // valid rating by merchant
    const rOk = await req('POST', '/ratings', { token: mTok, body: { orderId: deliveredOrder, rating: 5, onTime: true, carefulWithOrder: false, comment: 'x'.repeat(501) } });
    rOk.status < 300 ? fine('ratings', 'valid rating accepted (501-char comment — noting server cap)', `HTTP ${rOk.status}`) : defect('ratings', `valid rating rejected → ${rOk.status}`, JSON.stringify(rOk.data)?.slice(0, 100));
    // double rating
    const rDup = await req('POST', '/ratings', { token: mTok, body: { orderId: deliveredOrder, rating: 4 } });
    rDup.status === 409 ? fine('ratings', 'double rating → 409') : defect('ratings', `double rating → ${rDup.status}`);
    // driver average updated?
    const prof = await req('GET', '/drivers/me', { token: dTok });
    const avg = Number(prof.data?.rating);
    avg === 5 ? fine('ratings', `driver avg recalced`, `rating=${avg}`) : defect('ratings', `driver avg wrong`, `rating=${avg} expected 5.00`);
  }

  // ══ E. WITHDRAWALS — careless + race ══
  console.log('\n── E. withdrawals carelessness ──');
  {
    const bal = await req('GET', '/withdrawals/balance', { token: dTok });
    const available = Number(bal.data?.available ?? bal.data?.balance ?? 0);
    fine('withdrawals', 'balance fetched', `available=${available}`);
    const neg = await req('POST', '/withdrawals/request', { token: dTok, body: { amount: -100 } });
    [400, 403].includes(neg.status) ? fine('withdrawals', 'negative amount rejected', `HTTP ${neg.status}`) : defect('withdrawals', `negative amount → ${neg.status}`);
    const zero = await req('POST', '/withdrawals/request', { token: dTok, body: { amount: 0 } });
    [400, 403].includes(zero.status) ? fine('withdrawals', 'zero amount rejected', `HTTP ${zero.status}`) : defect('withdrawals', `zero amount → ${zero.status}`);
    const over = await req('POST', '/withdrawals/request', { token: dTok, body: { amount: available + 5000 } });
    [400, 403].includes(over.status) ? fine('withdrawals', 'over-balance rejected', `HTTP ${over.status}`) : defect('withdrawals', `over-balance → ${over.status}`, `tried ${available + 5000}`);
    // race: 5 concurrent withdrawals half-balance each
    if (available >= 2000) {
      const half = Math.floor(available / 2);
      const results = await Promise.all(
        Array.from({ length: 5 }, () => req('POST', '/withdrawals/request', { token: dTok, body: { amount: half } })),
      );
      const wins = results.filter((r) => r.status < 300);
      wins.length <= 1
        ? fine('race', `concurrent withdrawals → ${wins.length} success (no double-spend)`)
        : defect('race', `concurrent withdrawals → ${wins.length} SUCCESS`, `double-spend of ₡${half} x${wins.length}`);
      // cancel them back so driver keeps balance (fail = cancelled per app semantics)
      for (const w of wins) {
        await req('PUT', `/withdrawals/${w.data?.id}/cancel`, { token: dTok }).catch(() => {});
      }
    } else {
      fine('withdrawals', 'balance too small for race probe', 'skipping');
    }
  }

  // ══ F. FRONTENDS — real pages compile & serve ══
  console.log('\n── F. frontend pages ──');
  {
    for (const [base, paths] of [
      ['http://localhost:3000', ['/', '/orders', '/orders/new', '/menu']],
      ['http://localhost:3001', ['/', '/active', '/earnings', '/analytics', '/withdraw']],
    ]) {
      for (const p of paths) {
        try {
          const r = await fetch(`${base}${p}`);
          const text = r.status === 200 ? await r.text() : '';
          const crashed = /__NEXT_ERROR__|Application error/i.test(text);
          r.status === 200 && !crashed ? fine('frontend', `${base}${p}`) : defect('frontend', `${base}${p} → ${r.status}`, crashed ? 'error overlay' : '');
        } catch (e) {
          defect('frontend', `${base}${p} unreachable`, e.message);
        }
      }
    }
  }

  // cleanup: delete playtest orders where still possible
  for (const id of freightIds) {
    await req('PUT', `/orders/${id}/status`, { token: mTok, body: { status: 'cancelled' } }).catch(() => {});
  }

  // ══ Summary ══
  console.log('\n════════ PLAYTEST DEFECTS ════════');
  if (defects.length === 0) {
    console.log('NONE — all probes behaved.');
  } else {
    defects.forEach((d, i) => console.log(`${i + 1}. [${d.area}] ${d.what}${d.detail ? ` — ${d.detail}` : ''}`));
  }
  console.log(`\n${defects.length} defect(s), ${n} probe lines`);
}

main()
  .catch((e) => {
    console.error('PROBE CRASH:', e);
    process.exitCode = 2;
  })
  .finally(async () => {
    for (const c of children) {
      try {
        c.kill('SIGTERM');
      } catch {}
    }
    await sleep(500);
    for (const c of children) {
      try {
        c.kill('SIGKILL');
      } catch {}
    }
    process.exit(process.exitCode || 0);
  });
