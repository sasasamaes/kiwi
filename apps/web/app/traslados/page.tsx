// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { api, useAuth } from '@kiwi/ui';
import { Driver, toDriverList } from '../drivers/mappers';

/**
 * Traslados entre sedes de la misma cadena (ej. farmacia centro ↔ San
 * Martín): la sede origen pide un repartidor para llevar producto a la
 * destino. Solo viaje (sin venta), lo paga la sede origen.
 */
export default function TrasladosPage() {
  const { user } = useAuth();
  const [chain, setChain] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [toId, setToId] = useState('');
  const [desc, setDesc] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'credit' | 'weekly'>('cash');
  const [sent, setSent] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const myEntry = chain?.members?.find((m: any) => m.id === chain?.myId);
  const enabled = myEntry?.transfersEnabled === true;
  const weeklyOn = (user as any)?.merchantProfile?.weeklyBillingEnabled === true;
  const others = (chain?.members ?? []).filter((m: any) => m.id !== chain?.myId);

  const reload = async () => {
    try {
      const [c, av, z, mine, incoming] = await Promise.all([
        api.getMyChain().catch(() => null),
        api.getAvailableDrivers().catch(() => []),
        api.getDeliveryZones().catch(() => []),
        api.getMyOrders().catch(() => []),
        api.getIncomingTransfers().catch(() => []),
      ]);
      setChain(c);
      setDrivers(toDriverList(av));
      setZones(Array.isArray(z) ? z : []);
      const mineArr = Array.isArray(mine) ? mine : (mine?.items ?? []);
      setSent(mineArr.filter((o: any) => o.kind === 'transfer'));
      setReceived(Array.isArray(incoming) ? incoming : []);
    } catch {
      // listas best-effort
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    setMsg(null);
    if (!toId) {
      setErr('Elegí la sede destino');
      return;
    }
    if (!desc.trim()) {
      setErr('Describí qué se traslada');
      return;
    }
    if (!zoneId) {
      setErr('Elegí la zona de entrega (la de la sede destino)');
      return;
    }
    setBusy(true);
    try {
      const order = await api.createTransfer({
        toMerchantId: toId,
        packageDescription: desc.trim(),
        deliveryZone: zoneId,
        driverId: driverId || undefined,
        paymentMethod: payMethod === 'weekly' ? 'weekly_invoice' : payMethod,
      });
      if (payMethod !== 'cash') {
        await api.createPayment({
          orderId: order.id,
          method: payMethod === 'weekly' ? 'weekly_invoice' : 'credit',
          amount: Number(order.totalAmount),
        });
      }
      setMsg(
        `Traslado pedido ✓ (${(Number(order.totalAmount) || 0).toLocaleString('es-CR')} colones de viaje)`,
      );
      setDesc('');
      setToId('');
      setDriverId(null);
      await reload();
    } catch (e: any) {
      setErr(e?.message || 'No se pudo pedir el traslado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-28 pt-6">
      <h1 className="font-display text-2xl font-bold">🚚 Traslados entre sedes</h1>
      <p className="mt-1 text-sm text-surface-500">
        Pedí un repartidor para llevar producto a otra sede de tu cadena. Solo se cobra el viaje.
      </p>
      {(() => {
        const my = (chain?.members ?? []).find((m: any) => m.id === chain?.myId);
        const root = (chain?.members ?? []).find((m: any) => m.id === chain?.rootId);
        if (!my) return null;
        const others = (chain?.members ?? []).filter((m: any) => m.id !== chain?.myId);
        return (
          <p className="mt-2 rounded-xl bg-surface-100 dark:bg-surface-800 px-3 py-2 text-xs text-surface-600 dark:text-surface-300">
            Entraste como <b>{my.businessName}</b>
            {root && root.id !== my.id ? (
              <>
                {' '}
                · sede de <b>{root.businessName}</b>
              </>
            ) : (
              <> · sos la matriz de la cadena</>
            )}
            {others.length === 0 && ' · todavía no tenés sedes vinculadas.'}
          </p>
        );
      })()}

      {!chain ? (
        <p className="mt-6 text-sm text-surface-500">Cargando…</p>
      ) : !enabled ? (
        <div className="mt-6 rounded-2xl bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 p-4 text-sm">
          <p className="font-semibold text-gold-800 dark:text-gold-200">
            Entraste como “
            {(chain?.members ?? []).find((m: any) => m.id === chain?.myId)?.businessName ?? '—'}”.
          </p>
          <p className="mt-1 text-gold-800 dark:text-gold-200">
            Los traslados no están habilitados para este comercio. Pedile al admin de Kiwi que los
            active (y que revise que la sede esté colgada de su matriz).
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4">
            <div>
              <label className="mb-1 block text-xs font-medium">Sede destino *</label>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 text-sm"
              >
                <option value="">Elegí una sede…</option>
                {others.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.businessName} — {m.address}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">¿Qué se traslada? *</label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ej. 2 cajas de acetaminofén, 1 hielera"
                className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Zona de la sede destino *</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 text-sm"
              >
                <option value="">Elegí la zona…</option>
                {zones.map((z: any) => (
                  <option key={z.id} value={z.id}>
                    {z.label ?? z.id} — ₡{Number(z.price ?? 0).toLocaleString('es-CR')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                Repartidor (opcional = concurso)
              </label>
              <select
                value={driverId ?? ''}
                onChange={(e) => setDriverId(e.target.value || null)}
                className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 text-sm"
              >
                <option value="">Concurso (toda la flota)</option>
                {drivers
                  .filter((d) => d.status === 'available')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Paga la sede origen con</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'cash', label: 'Efectivo' },
                    { id: 'credit', label: 'Crédito' },
                    ...(weeklyOn ? [{ id: 'weekly', label: 'Semanal' }] : []),
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayMethod(m.id as 'cash' | 'credit' | 'weekly')}
                    className={`rounded-xl p-3 text-sm font-medium ${payMethod === m.id ? 'border-2 border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30' : 'border border-surface-200 dark:border-surface-700'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            {msg && <p className="text-sm text-green-700 dark:text-green-400">{msg}</p>}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="w-full rounded-xl bg-kiwi-700 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Pidiendo…' : 'Pedir traslado'}
            </button>
          </div>

          <h2 className="mt-6 mb-2 text-sm font-semibold">📥 Traslados que recibe mi sede</h2>
          {received.length === 0 ? (
            <p className="text-xs text-surface-500">Ninguno por ahora.</p>
          ) : (
            <div className="space-y-2">
              {received.map((o: any) => (
                <div
                  key={o.id}
                  className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-3 text-sm"
                >
                  <p className="font-medium">{o.merchant?.businessName ?? 'Otra sede'} → mi sede</p>
                  <p className="text-xs text-surface-500">
                    {o.packageDescription} · {o.status} · {o.driver?.fullName ?? 'sin repartidor'}
                  </p>
                </div>
              ))}
            </div>
          )}

          <h2 className="mt-6 mb-2 text-sm font-semibold">📤 Traslados que pedí</h2>
          {sent.length === 0 ? (
            <p className="text-xs text-surface-500">Todavía no pediste traslados.</p>
          ) : (
            <div className="space-y-2">
              {sent.map((o: any) => (
                <div
                  key={o.id}
                  className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-3 text-sm"
                >
                  <p className="font-medium">{o.packageDescription}</p>
                  <p className="text-xs text-surface-500">
                    {o.status} · ₡{Number(o.totalAmount ?? 0).toLocaleString('es-CR')} ·{' '}
                    {o.driver?.fullName ?? 'sin repartidor'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
