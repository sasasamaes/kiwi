// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Ban, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { api, useTranslations } from '@kiwi/ui';

interface Veto {
  id: string;
  merchantId: string;
  driverId: string;
  reason: string | null;
  createdAt: string;
  driver?: { id: string; fullName: string };
}

export default function AdminVetoesPage() {
  const { t } = useTranslations();
  const [merchants, setMerchants] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState('');
  const [vetoes, setVetoes] = useState<Veto[]>([]);
  const [driverId, setDriverId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMerchantsAdmin?.()
      .then((res: any) => setMerchants(Array.isArray(res) ? res : []))
      .catch(() => setMerchants([]));
    api
      .getDriversAdminList()
      .then((res: any) => setDrivers(Array.isArray(res) ? res : []))
      .catch(() => setDrivers([]));
  }, []);

  const load = useCallback(
    async (mid: string) => {
      if (!mid) {
        setVetoes([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.getVetoedDriversByMerchant(mid);
        setVetoes(Array.isArray(res) ? res : []);
      } catch {
        setError(t('webadmin1.avetoes.errLoad'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    load(merchantId);
  }, [merchantId, load]);

  const add = async () => {
    if (!merchantId || !driverId) {
      setError(t('webadmin1.avetoes.errPick'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.addVetoedDriverByMerchant(merchantId, driverId, reason.trim() || undefined);
      setDriverId('');
      setReason('');
      await load(merchantId);
    } catch {
      setError(t('webadmin1.avetoes.errSave'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (did: string) => {
    setError(null);
    try {
      await api.removeVetoedDriverByMerchant(merchantId, did);
      await load(merchantId);
    } catch {
      setError(t('webadmin1.avetoes.errSave'));
    }
  };

  const vetoedIds = new Set(vetoes.map((v) => v.driverId));
  const availableDrivers = drivers.filter((d) => !vetoedIds.has(d.id));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-surface-500 dark:text-surface-400 hover:text-surface-800"
        >
          ← Admin
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          <Ban className="h-6 w-6" /> {t('webadmin1.avetoes.title')}
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {t('webadmin1.avetoes.subtitle')}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft p-4">
        <label
          htmlFor="veto-merchant"
          className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
        >
          {t('webadmin1.avetoes.merchant')}
        </label>
        <select
          id="veto-merchant"
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 text-sm"
        >
          <option value="">{t('webadmin1.avetoes.pickMerchant')}</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.businessName}
            </option>
          ))}
        </select>
      </div>

      {merchantId && (
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft p-4 space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label
                htmlFor="veto-driver"
                className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
              >
                {t('webadmin1.avetoes.driver')}
              </label>
              <select
                id="veto-driver"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 text-sm"
              >
                <option value="">{t('webadmin1.avetoes.pickDriver')}</option>
                {availableDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="veto-reason"
                className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
              >
                {t('webadmin1.avetoes.reason')}
              </label>
              <input
                id="veto-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('webadmin1.avetoes.reasonPh')}
                maxLength={200}
                className="min-h-[44px] w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 text-sm"
              />
            </div>
            <div className="flex items-end">
              <motion.button
                onClick={add}
                disabled={saving || !driverId}
                className="min-h-[44px] rounded-xl bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                whileTap={{ scale: 0.97 }}
              >
                {t('webadmin1.avetoes.add')}
              </motion.button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-surface-500">…</p>
          ) : vetoes.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('webadmin1.avetoes.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-surface-100 dark:divide-surface-700">
              {vetoes.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-3">
                  <Ban className="h-5 w-5 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-100">
                      {v.driver?.fullName ?? v.driverId}
                    </p>
                    <p className="truncate text-xs text-surface-500 dark:text-surface-400">
                      {[
                        v.reason,
                        t('webadmin1.avetoes.vetoedOn', {
                          date: new Date(v.createdAt).toLocaleDateString('es-CR', {
                            day: 'numeric',
                            month: 'short',
                          }),
                        }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(v.driverId)}
                    title={t('webadmin1.avetoes.remove')}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-surface-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
}
