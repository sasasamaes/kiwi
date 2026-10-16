// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TicketPercent, Plus, X, Loader2 } from 'lucide-react';
import { api } from '@kiwi/ui';

interface Offer {
  title: string;
  detail: string;
}

interface Referral {
  id: string;
  code: string;
  active: boolean;
  offers: Record<string, Offer>;
  uses: number;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  customer: 'Clientes',
  driver: 'Repartidores',
  merchant: 'Comercios',
};

const emptyOffers = (): Record<string, Offer> => ({
  customer: { title: '', detail: '' },
  driver: { title: '', detail: '' },
  merchant: { title: '', detail: '' },
});

export default function ReferidosPage() {
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Referral | null>(null);
  const [editOffers, setEditOffers] = useState<Record<string, Offer>>(emptyOffers());
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listReferrals();
      setItems(r?.referrals ?? []);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los códigos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setCreating(true);
    try {
      await api.createReferral({ code: newCode.trim(), offers: {} });
      setNewCode('');
      load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear el código');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (r: Referral) => {
    setEditing(r);
    setEditOffers({ ...emptyOffers(), ...r.offers });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.updateReferral(editing.id, { offers: editOffers });
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r: Referral) => {
    setToggling(r.id);
    try {
      await api.setReferralActive(r.id, !r.active);
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar el estado');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          <TicketPercent className="h-6 w-6 inline" /> Referidos
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Códigos que el registro muestra con su oferta según la app. KIKO y WICHO ya vienen
          cargados.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <motion.form
        onSubmit={handleCreate}
        className="flex gap-2 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <input
          value={newCode}
          onChange={(e) =>
            setNewCode(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 20),
            )
          }
          placeholder="NUEVO CÓDIGO"
          className="flex-1 px-4 py-2.5 text-sm uppercase rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
        />
        <motion.button
          type="submit"
          disabled={creating || !newCode.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-kiwi-gradient text-white text-sm font-semibold disabled:opacity-50"
          whileTap={{ scale: 0.97 }}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Agregar
        </motion.button>
      </motion.form>

      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Código
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Ofertas por app
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Usos
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Estado
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-surface-400">
                    Cargando…
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-surface-800 dark:text-surface-100">
                        {r.code}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1 text-xs text-surface-600 dark:text-surface-300">
                        {(['customer', 'driver', 'merchant'] as const).map((role) => (
                          <p key={role}>
                            <b>{ROLE_LABELS[role]}:</b>{' '}
                            {r.offers?.[role]?.title || <span className="text-surface-400">—</span>}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                        {r.uses}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          r.active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-surface-100 text-surface-500'
                        }`}
                      >
                        {r.active ? 'Activo' : 'Pausado'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="px-3 py-1.5 text-xs font-medium text-surface-500 hover:text-kiwi-700 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30 rounded-lg transition-colors"
                        >
                          Ofertas
                        </button>
                        <button
                          onClick={() => handleToggle(r)}
                          disabled={toggling === r.id}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            r.active
                              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                              : 'text-kiwi-700 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30'
                          }`}
                        >
                          {r.active ? 'Pausar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {editing && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditing(null)}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90dvh] overflow-y-auto"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                  Ofertas de <span className="font-mono">{editing.code}</span>
                </h3>
                <button
                  onClick={() => setEditing(null)}
                  className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                {(['customer', 'driver', 'merchant'] as const).map((role) => (
                  <div
                    key={role}
                    className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-4 space-y-2"
                  >
                    <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                      {ROLE_LABELS[role]}
                    </p>
                    <input
                      value={editOffers[role]?.title ?? ''}
                      onChange={(e) =>
                        setEditOffers((prev) => ({
                          ...prev,
                          [role]: { ...prev[role], title: e.target.value },
                        }))
                      }
                      placeholder="Título corto (ej. ₡2.000 de regalo)"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                    />
                    <textarea
                      value={editOffers[role]?.detail ?? ''}
                      onChange={(e) =>
                        setEditOffers((prev) => ({
                          ...prev,
                          [role]: { ...prev[role], detail: e.target.value },
                        }))
                      }
                      placeholder="Detalle de la oferta"
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-4 w-full py-2.5 rounded-xl bg-kiwi-gradient text-white text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar ofertas'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
