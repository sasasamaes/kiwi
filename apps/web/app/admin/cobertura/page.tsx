// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Globe, Send, Loader2 } from 'lucide-react';
import { api } from '@kiwi/ui';

interface DemandRow {
  city: string;
  total: number;
  notified: number;
  pending: number;
  emails: string[];
}

interface CityRow {
  slug: string;
  name: string;
  active: boolean;
}

export default function CoberturaPage() {
  const [cities, setCities] = useState<CityRow[]>([]);
  const [demand, setDemand] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.getCoverageSummary();
      setCities(r?.cities ?? []);
      setDemand(r?.demand ?? []);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la cobertura');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleNotify = async (city: string) => {
    if (!window.confirm(`¿Avisar por correo a los interesados de ${city} que ya llegamos?`)) return;
    setSending(city);
    setNotice(null);
    try {
      const r = await api.notifyCoverageCity(city);
      setNotice({
        ok: r.failed === 0,
        text: `${city}: avisados ${r.sent}${r.failed ? `, fallaron ${r.failed}` : ''}.`,
      });
      load();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message || 'No se pudo avisar' });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          <Globe className="h-6 w-6 inline" /> Cobertura
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Dónde quieren usar Kiwi y aún no llegamos — para decidir dónde abrir.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.ok
              ? 'bg-kiwi-50 dark:bg-kiwi-900/30 border-kiwi-200 dark:border-kiwi-800 text-kiwi-700 dark:text-kiwi-300'
              : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Ciudades operativas */}
      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-3">
          Ciudades
        </h3>
        <div className="flex flex-wrap gap-2">
          {cities.map((c) => (
            <span
              key={c.slug}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                c.active ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-500'
              }`}
            >
              {c.name} · {c.active ? 'operando' : 'próximamente'}
            </span>
          ))}
          {cities.length === 0 && !loading && (
            <p className="text-sm text-surface-500 dark:text-surface-400">Sin ciudades.</p>
          )}
        </div>
      </motion.div>

      {/* Demanda */}
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
                  Lugar
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Interesados
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Avisados
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Pendientes
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm text-surface-500 dark:text-surface-400"
                  >
                    Cargando…
                  </td>
                </tr>
              ) : (
                demand.map((d) => (
                  <tr
                    key={d.city}
                    className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <p className="font-medium text-surface-800 dark:text-surface-200">{d.city}</p>
                      {d.emails.length > 0 && (
                        <p className="text-xs text-surface-500 dark:text-surface-400 truncate max-w-xs">
                          {d.emails.join(', ')}
                          {d.pending > d.emails.length ? '…' : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-lg font-bold text-surface-800 dark:text-surface-100">
                        {d.total}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-surface-500">{d.notified}</td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-semibold text-kiwi-700 dark:text-kiwi-300">
                        {d.pending}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleNotify(d.city)}
                          disabled={sending === d.city || d.pending === 0}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-kiwi-700 text-white hover:bg-kiwi-800 disabled:opacity-40"
                        >
                          {sending === d.city ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Avisar al llegar
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

      {!loading && demand.length === 0 && !error && (
        <p className="text-center text-sm text-surface-500 dark:text-surface-400">
          Nadie en lista de espera todavía. Aparecen acá los registros y pedidos fuera de zona.
        </p>
      )}
    </div>
  );
}
