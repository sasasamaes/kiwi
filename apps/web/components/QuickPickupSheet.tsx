// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link2, Timer, Trophy, X } from 'lucide-react';
import { api, useAuth, ZonePicker, parseMapLink } from '@kiwi/ui';
import { detectDeliveryZoneFromText, findNearestZone } from '@kiwi/types';
import { toDriverList, type Driver } from '../app/drivers/mappers';

const READY_OPTIONS = [15, 20, 30] as const;

/**
 * Hoja de pedido rápido (botón flotante del comercio): lo esencial para que
 * un restaurante pida repartidor cuando la comida sale en 15-30 min.
 * Crea un pedido immediate con readyAt = ahora + N (cash por defecto).
 *
 * Extras: pegar link de WhatsApp (ubica coords + detecta barrio y precio) y
 * elegir repartidor (favorito/disponible) o mandarlo a concurso.
 */
export function QuickPickupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState('');
  const [detail, setDetail] = useState('');
  const [readyIn, setReadyIn] = useState<(typeof READY_OPTIONS)[number]>(15);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLink, setMapLink] = useState('');
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  // Repartidores al abrir (favoritos + disponibles, una sola lista).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDriversLoading(true);
    Promise.all([
      api.getFavoriteDrivers().catch(() => []),
      api.getAvailableDrivers().catch(() => []),
    ])
      .then(([favs, avail]) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const merged: Driver[] = [];
        for (const d of [...toDriverList(favs), ...toDriverList(avail)]) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          merged.push(d);
        }
        setDrivers(merged.filter((d) => d.status === 'available'));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDriversLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reset = () => {
    setName('');
    setPhone('');
    setAddress('');
    setZone('');
    setDetail('');
    setReadyIn(15);
    setCoords(null);
    setMapLink('');
    setLinkMsg(null);
    setSelectedDriverId(null);
    setError(null);
    setCreated(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const applyCoords = async (lat: number, lng: number, label: string) => {
    setCoords({ lat, lng });
    setAddress((prev) => prev || label);
    const near = findNearestZone(lat, lng);
    if (near?.confident) {
      setZone(near.zone.id);
      setLinkMsg(
        `Ubicación fijada · Zona: ${near.zone.label} — ₡${near.zone.price.toLocaleString()}`,
      );
      return;
    }
    try {
      const rev: any = await api.reverseGeocode(lat, lng);
      const addr = rev?.address ?? {};
      const z = detectDeliveryZoneFromText(
        addr.neighbourhood,
        addr.suburb,
        addr.road,
        addr.village,
        addr.hamlet,
        addr.town,
        addr.city,
        rev?.displayName,
        rev?.shortName,
      );
      if (z) {
        setZone(z.id);
        setLinkMsg(`Ubicación fijada · Zona: ${z.label} — ₡${z.price.toLocaleString()}`);
        return;
      }
    } catch {
      // cae al mensaje manual
    }
    setLinkMsg('Ubicación fijada. Elegí el barrio manualmente.');
  };

  const locateFromLink = async () => {
    const parsed = parseMapLink(mapLink);
    if (!parsed) {
      setLinkMsg('Pegá el link que te enviaron por WhatsApp (maps.google.com…)');
      return;
    }
    setLocating(true);
    try {
      if (parsed.kind === 'coords') {
        await applyCoords(parsed.point.lat, parsed.point.lng, parsed.point.label);
        setMapLink('');
        return;
      }
      // Acortado o texto: resolver vía backend.
      const q = parsed.kind === 'short' ? mapLink : parsed.query;
      let r: any = null;
      try {
        r = parsed.kind === 'short' ? await api.resolveMapLink(mapLink) : null;
      } catch {
        r = null;
      }
      if (r && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng))) {
        const lat = Number(r.lat);
        const lng = Number(r.lng);
        await applyCoords(lat, lng, r.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setMapLink('');
        return;
      }
      if (parsed.kind === 'query') {
        const res: any = await api.searchNicoyaAddresses(q, 1);
        const first = Array.isArray(res) ? res[0] : null;
        if (first && Number.isFinite(Number(first.lat)) && Number.isFinite(Number(first.lng))) {
          await applyCoords(Number(first.lat), Number(first.lng), first.displayName);
          setMapLink('');
          return;
        }
      }
      setLinkMsg('No se pudo abrir ese link. Escribí la dirección a mano.');
    } catch {
      setLinkMsg('No se pudo abrir ese link. Escribí la dirección a mano.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (!name.trim() || digits.length < 8 || !address.trim() || !zone.trim()) {
      setError('Completá nombre, teléfono (8 dígitos), dirección y barrio');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const pickup = (user as any)?.merchantProfile?.address?.trim() || 'Nicoya Centro';
      await api.createOrder(
        {
          kind: 'food',
          orderType: 'immediate',
          customerName: name.trim(),
          customerPhone: digits,
          deliveryAddress: address.trim(),
          deliveryZone: zone,
          ...(coords ? { deliveryLat: coords.lat, deliveryLng: coords.lng } : {}),
          pickupAddress: pickup,
          specialInstructions: detail.trim()
            ? `Pedido rápido · ${detail.trim().slice(0, 500)}`
            : 'Pedido rápido',
          paymentMethod: 'cash',
          readyInMinutes: readyIn,
          ...(selectedDriverId ? { driverId: selectedDriverId } : {}),
        },
        {
          idempotencyKey:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      );
      setCreated(true);
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el pedido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white dark:bg-surface-800 p-6 shadow-2xl"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                <Timer className="h-5 w-5 text-kiwi-700" /> Pedido rápido
              </h3>
              <button
                onClick={close}
                aria-label="Cerrar"
                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {created ? (
              <div className="rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4 text-center">
                <p className="font-semibold text-kiwi-700 dark:text-kiwi-300">
                  ¡Listo! Buscando repartidor
                </p>
                <p className="mt-1 text-sm text-surface-500">Llega a recoger en ~{readyIn} min</p>
                <button
                  onClick={close}
                  className="mt-4 w-full rounded-xl bg-kiwi-700 py-2.5 font-semibold text-white"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2.5 text-sm focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Teléfono 8888-1234"
                    inputMode="tel"
                    className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2.5 text-sm focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                  />
                </div>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Dirección de entrega"
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2.5 text-sm focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                />
                <div className="flex gap-2">
                  <input
                    value={mapLink}
                    onChange={(e) => setMapLink(e.target.value)}
                    placeholder="Link de WhatsApp (Maps…)"
                    inputMode="url"
                    className="min-w-0 flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2.5 text-sm focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                  />
                  <button
                    type="button"
                    onClick={locateFromLink}
                    disabled={locating || !mapLink.trim()}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-surface-800 dark:bg-surface-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Link2 className="h-4 w-4" />
                    {locating ? '…' : 'Ubicar'}
                  </button>
                </div>
                {linkMsg && (
                  <p className="text-xs text-surface-500 dark:text-surface-400">{linkMsg}</p>
                )}
                <ZonePicker value={zone} onChange={setZone} />
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Detalle: 2 pizzas grandes, 1 coca…"
                  rows={2}
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2.5 text-sm resize-none focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                />
                <div>
                  <p className="mb-2 text-xs font-semibold text-surface-500">
                    La comida está lista en
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {READY_OPTIONS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setReadyIn(m)}
                        className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                          readyIn === m
                            ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/20 text-kiwi-700'
                            : 'border-surface-200 dark:border-surface-700 text-surface-600'
                        }`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-surface-500">Repartidor</p>
                  <button
                    type="button"
                    onClick={() => setSelectedDriverId(null)}
                    className={`mb-2 w-full rounded-xl border-2 p-3 text-left transition-all ${
                      selectedDriverId === null
                        ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/20'
                        : 'border-surface-200 dark:border-surface-700'
                    }`}
                  >
                    <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                      <Trophy className="mr-1 inline h-4 w-4" />
                      En concurso {selectedDriverId === null && '✓'}
                    </p>
                    <p className="text-xs text-surface-500">
                      Se avisa a los disponibles · el primero que acepta se lo lleva
                    </p>
                  </button>
                  {driversLoading ? (
                    <p className="text-xs text-surface-400">Cargando repartidores…</p>
                  ) : drivers.length === 0 ? (
                    <p className="text-xs text-surface-400">
                      Nadie disponible ahora. Quedará en concurso.
                    </p>
                  ) : (
                    <div className="max-h-36 space-y-1.5 overflow-y-auto">
                      {drivers.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() =>
                            setSelectedDriverId(selectedDriverId === d.id ? null : d.id)
                          }
                          className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                            selectedDriverId === d.id
                              ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/20'
                              : 'border-surface-200 dark:border-surface-700'
                          }`}
                        >
                          <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                            {selectedDriverId === d.id && '✓ '}
                            {d.fullName}
                          </p>
                          <p className="text-xs text-surface-500">
                            {[d.vehicleType, d.vehiclePlate].filter(Boolean).join(' · ') ||
                              'Disponible'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {error && (
                  <p role="alert" className="text-sm font-medium text-red-500">
                    {error}
                  </p>
                )}
                <button
                  onClick={submit}
                  disabled={saving}
                  className="w-full rounded-xl bg-kiwi-700 py-3 font-semibold text-white hover:bg-kiwi-800 disabled:opacity-50"
                >
                  {saving ? 'Creando…' : `Pedir repartidor · ~${readyIn} min`}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
