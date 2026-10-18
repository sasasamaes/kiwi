// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Send, Trash2, Loader2, Search } from 'lucide-react';
import { api, useTranslations } from '@kiwi/ui';

interface Visit {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  outcome: string;
  notes: string | null;
  followUpAt: string | null;
  invitationId: string | null;
  createdAt: string;
}

const OUTCOMES = [
  {
    value: 'pending',
    labelKey: 'webadmin2.avis.outcomes.pending',
    color: 'bg-surface-100 text-surface-500',
  },
  {
    value: 'interested',
    labelKey: 'webadmin2.avis.outcomes.interested',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'invited',
    labelKey: 'webadmin2.avis.outcomes.invited',
    color: 'bg-yellow-100 text-yellow-700',
  },
  {
    value: 'registered',
    labelKey: 'webadmin2.avis.outcomes.registered',
    color: 'bg-green-100 text-green-700',
  },
  {
    value: 'not_interested',
    labelKey: 'webadmin2.avis.outcomes.not_interested',
    color: 'bg-red-100 text-red-500',
  },
] as const;

const outcomeOf = (v: string) => OUTCOMES.find((o) => o.value === v) ?? OUTCOMES[0];

const isOverdue = (v: Visit) =>
  v.followUpAt &&
  new Date(v.followUpAt).getTime() <= Date.now() &&
  v.outcome !== 'registered' &&
  v.outcome !== 'not_interested';

export default function VisitasPage() {
  const { t } = useTranslations();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [visitOutcome, setVisitOutcome] = useState('pending');
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listVisits({
        outcome: outcome || undefined,
        search: search.trim() || undefined,
        followUp: onlyDue ? 'due' : undefined,
        take: 50,
      });
      setVisits(r?.visits ?? []);
      setTotal(Number(r?.total ?? 0));
    } catch (e: any) {
      setError(e?.message || t('webadmin2.avis.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [outcome, search, onlyDue]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) return;
    setSaving(true);
    try {
      await api.createVisit({
        businessName: businessName.trim(),
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        outcome: visitOutcome,
        notes: notes.trim() || undefined,
        followUpAt: followUpAt || undefined,
      });
      setBusinessName('');
      setContactName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setVisitOutcome('pending');
      setNotes('');
      setFollowUpAt('');
      setNotice(t('webadmin2.avis.saved'));
      setTimeout(() => setNotice(null), 3000);
      load();
    } catch (err: any) {
      setError(err?.message || t('webadmin2.avis.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const setRowOutcome = async (v: Visit, next: string) => {
    setActing(v.id);
    try {
      await api.updateVisit(v.id, { outcome: next });
      load();
    } catch (e: any) {
      setError(e?.message || t('webadmin2.avis.updateFailed'));
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async (v: Visit) => {
    if (!window.confirm(t('webadmin2.avis.deleteConfirm', { name: v.businessName }))) return;
    setActing(v.id);
    try {
      await api.deleteVisit(v.id);
      load();
    } catch (e: any) {
      setError(e?.message || t('webadmin2.avis.deleteFailed'));
    } finally {
      setActing(null);
    }
  };

  const inviteHref = (v: Visit) => {
    const q = new URLSearchParams({ role: 'merchant' });
    if (v.email) q.append('email', v.email);
    if (v.phone) q.append('phone', v.phone);
    q.append('name', v.businessName);
    return `/admin/invitaciones?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          <MapPin className="h-6 w-6 inline" /> {t('webadmin2.avis.title')}
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          {t('webadmin2.avis.subtitle')}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800 px-4 py-3 text-sm text-kiwi-700 dark:text-kiwi-300">
          {notice}
        </div>
      )}

      {/* Carga rápida en campo */}
      <motion.form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="v-biz"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              {t('webadmin2.avis.business')}
            </label>
            <input
              id="v-biz"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t('webadmin2.avis.businessPh')}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
          <div>
            <label
              htmlFor="v-contact"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              {t('webadmin2.avis.contact')}
            </label>
            <input
              id="v-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={t('webadmin2.avis.contactPh')}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
          <div>
            <label
              htmlFor="v-outcome"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              {t('webadmin2.avis.outcome')}
            </label>
            <select
              id="v-outcome"
              value={visitOutcome}
              onChange={(e) => setVisitOutcome(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="v-email"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              {t('webadmin2.avis.email')}
            </label>
            <input
              id="v-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('webadmin2.avis.emailPh')}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
          <div>
            <label
              htmlFor="v-phone"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              {t('webadmin2.avis.phone')}
            </label>
            <input
              id="v-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('webadmin2.avis.phonePh')}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
          <div>
            <label
              htmlFor="v-follow"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              {t('webadmin2.avis.followUp')}
            </label>
            <input
              id="v-follow"
              type="date"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t('webadmin2.avis.addressPh')}
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('webadmin2.avis.notesPh')}
          rows={2}
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
        />
        <motion.button
          type="submit"
          disabled={saving || !businessName.trim()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-kiwi-gradient text-white text-sm font-semibold disabled:opacity-50"
          whileTap={{ scale: 0.97 }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {t('webadmin2.avis.submit')}
        </motion.button>
      </motion.form>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500 dark:text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('webadmin2.avis.searchPh')}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
          />
        </div>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100"
        >
          <option value="">{t('webadmin2.avis.all')}</option>
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setOnlyDue((v) => !v)}
          className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
            onlyDue
              ? 'bg-amber-500 text-white'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
          }`}
        >
          {t('webadmin2.avis.overdueOnly')}
        </button>
      </div>

      <p className="text-sm text-surface-500 dark:text-surface-400">
        {t('webadmin2.avis.total', { n: total })}
      </p>

      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-sm text-surface-500 dark:text-surface-400">
            {t('webadmin2.avis.loading')}
          </p>
        ) : (
          visits.map((v) => {
            const o = outcomeOf(v.outcome);
            return (
              <motion.div
                key={v.id}
                className={`rounded-2xl bg-white dark:bg-surface-800 border shadow-soft dark:shadow-dark p-4 ${
                  isOverdue(v)
                    ? 'border-amber-300 dark:border-amber-500/40'
                    : 'border-surface-200/60 dark:border-white/[0.06]'
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-surface-800 dark:text-surface-100">
                      {v.businessName}
                      {isOverdue(v) && (
                        <span className="ml-2 text-xs font-medium text-amber-600">
                          {t('webadmin2.avis.overdue')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {[v.contactName, v.email, v.phone].filter(Boolean).join(' · ')}
                      {v.followUpAt && (
                        <>
                          {' '}
                          {t('webadmin2.avis.followUpOn', {
                            date: new Date(v.followUpAt).toLocaleDateString('es-CR'),
                          })}
                        </>
                      )}
                    </p>
                    {v.notes && (
                      <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">
                        {v.notes}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${o.color}`}
                  >
                    {t(o.labelKey)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={v.outcome}
                    disabled={acting === v.id}
                    onChange={(e) => setRowOutcome(v, e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-200 disabled:opacity-50"
                    aria-label={t('webadmin2.avis.changeOutcome')}
                  >
                    {OUTCOMES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                  {(v.email || v.phone) && v.outcome !== 'registered' && (
                    <Link
                      href={inviteHref(v)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-300 hover:bg-kiwi-100"
                    >
                      <Send className="h-3.5 w-3.5" /> {t('webadmin2.avis.invite')}
                    </Link>
                  )}
                  <button
                    onClick={() => handleDelete(v)}
                    disabled={acting === v.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t('webadmin2.avis.delete')}
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
        {!loading && visits.length === 0 && (
          <p className="text-center text-sm text-surface-500 dark:text-surface-400">
            {t('webadmin2.avis.empty')}
          </p>
        )}
      </div>
    </div>
  );
}
