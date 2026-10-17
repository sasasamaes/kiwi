// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Check, X } from 'lucide-react';
import { useDeliveryZones } from './useDeliveryZones';

interface ZonePickerProps {
  value: string;
  onChange: (zoneId: string) => void;
  /**
   * Etiqueta de la zona detectada por GPS cuando su id todavía no está en
   * la lista (los ids de la DB son UUIDs y la lista puede venir del
   * catálogo local si el fetch falló): en vez del placeholder engañoso se
   * muestra lo detectado.
   */
  detectedLabel?: string | null;
}

/**
 * Selector bonito de barrio con precio de envío visible.
 * Botón compacto + hoja modal con la lista alfabética (es-CR).
 * El precio es informativo: el servidor revalida la zona al cobrar.
 */
export function ZonePicker({ value, onChange, detectedLabel }: ZonePickerProps) {
  const [open, setOpen] = useState(false);
  const zones = [...useDeliveryZones()].sort((a, b) => a.label.localeCompare(b.label, 'es-CR'));
  const selected = zones.find((z) => z.id === value);
  const detected = !selected && value ? detectedLabel || 'Barrio detectado' : null;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-400/10">
          <MapPin className="h-4 w-4 text-kiwi-700 dark:text-kiwi-300" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] uppercase tracking-wide text-surface-500 dark:text-surface-400">
            Barrio de entrega
          </span>
          <span
            className={`block text-sm truncate ${selected || detected ? 'font-medium' : 'text-surface-500 dark:text-surface-400'}`}
          >
            {selected ? selected.label : (detected ?? 'Elegí tu barrio…')}
          </span>
        </span>
        {selected && (
          <span className="shrink-0 rounded-full bg-kiwi-600/10 px-2.5 py-1 text-xs font-bold text-kiwi-700 dark:text-kiwi-300">
            ₡{selected.price.toLocaleString()}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="relative w-full max-w-md max-h-[75dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-surface-800 shadow-2xl overflow-hidden"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div>
                  <p className="font-display font-bold text-surface-800 dark:text-surface-100">
                    Elegí tu barrio
                  </p>
                  <p className="text-xs text-surface-500">Con el precio del envío incluido</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-3 pb-4 pt-1">
                {zones.map((z) => {
                  const active = z.id === value;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => pick(z.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                        active
                          ? 'bg-kiwi-50 dark:bg-kiwi-400/10'
                          : 'hover:bg-surface-50 dark:hover:bg-surface-700/50'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          active
                            ? 'bg-kiwi-600 text-white'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-500'
                        }`}
                      >
                        {active ? <Check className="h-4 w-4" /> : z.label.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="flex-1 text-sm font-medium text-surface-800 dark:text-surface-100">
                        {z.label}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          active
                            ? 'bg-kiwi-600 text-white'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'
                        }`}
                      >
                        ₡{z.price.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
