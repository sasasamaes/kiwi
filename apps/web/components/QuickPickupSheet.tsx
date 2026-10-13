// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Timer, X } from 'lucide-react';
import { api, useAuth, ZonePicker } from '@kiwi/ui';

const READY_OPTIONS = [15, 20, 30] as const;

/**
 * Hoja de pedido rápido (botón flotante del comercio): lo esencial para que
 * un restaurante pida repartidor cuando la comida sale en 15-30 min.
 * Crea un pedido immediate con readyAt = ahora + N (cash por defecto).
 */
export function QuickPickupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState('');
  const [detail, setDetail] = useState('');
  const [readyIn, setReadyIn] = useState<(typeof READY_OPTIONS)[number]>(15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const reset = () => {
    setName('');
    setPhone('');
    setAddress('');
    setZone('');
    setDetail('');
    setReadyIn(15);
    setError(null);
    setCreated(false);
  };

  const close = () => {
    reset();
    onClose();
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
          pickupAddress: pickup,
          specialInstructions: detail.trim()
            ? `Pedido rápido · ${detail.trim().slice(0, 500)}`
            : 'Pedido rápido',
          paymentMethod: 'cash',
          readyInMinutes: readyIn,
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
            className="w-full max-w-md rounded-3xl bg-white dark:bg-surface-800 p-6 shadow-2xl"
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
