// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Store, Bike, Send, Copy, Check, RefreshCw, X, Mail, Loader2 } from 'lucide-react';
import { api } from '@kiwi/ui';

type Role = 'merchant' | 'driver';
type StatusFilter = 'pending' | 'accepted' | 'all';

interface Invitation {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  role: string;
  status: string;
  expiresAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

const statusLabel = (status: string) => {
  switch (status) {
    case 'accepted':
      return { label: 'Aceptada', color: 'bg-green-100 text-green-700' };
    case 'revoked':
      return { label: 'Revocada', color: 'bg-red-100 text-red-500' };
    default:
      return { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' };
  }
};

export default function InvitacionesPage() {
  const [role, setRole] = useState<Role>('merchant');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [items, setItems] = useState<Invitation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [lastLink, setLastLink] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (r: Role, s: StatusFilter) => {
    setLoading(true);
    try {
      const res = await api.listInvitations({
        role: r,
        status: s === 'all' ? undefined : s,
        take: 50,
      });
      setItems(Array.isArray(res?.invitations) ? res.invitations : []);
      setTotal(Number(res?.total ?? 0));
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message || 'No se pudieron cargar las invitaciones' });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(role, statusFilter);
  }, [role, statusFilter, load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLastLink(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Escribí un email válido');
      return;
    }
    setSending(true);
    try {
      const res = await api.createInvitation({
        email: email.trim(),
        phone: phone.trim() || undefined,
        name: name.trim() || undefined,
        role,
      });
      setLastLink({ url: res.inviteUrl, emailSent: res.emailSent });
      setNotice({
        ok: res.emailSent,
        text: res.emailSent
          ? `Invitación enviada a ${res.invitation.email}`
          : `Guardada, pero el correo NO salió (SMTP sin configurar). Copiá el link y mandalo manual.`,
      });
      setEmail('');
      setPhone('');
      setName('');
      load(role, statusFilter);
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo crear la invitación');
    } finally {
      setSending(false);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResend = async (id: string) => {
    setActing(id);
    setNotice(null);
    try {
      const res = await api.resendInvitation(id);
      setLastLink({ url: res.inviteUrl, emailSent: res.emailSent });
      setNotice({
        ok: res.emailSent,
        text: res.emailSent
          ? 'Invitación reenviada con un link nuevo (el anterior ya no vale)'
          : 'Link renovado, pero el correo NO salió (SMTP sin configurar). Copiá el link de abajo.',
      });
      load(role, statusFilter);
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message || 'No se pudo reenviar' });
    } finally {
      setActing(null);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('¿Revocar esta invitación? El link deja de funcionar.')) return;
    setActing(id);
    try {
      await api.revokeInvitation(id);
      setNotice({ ok: true, text: 'Invitación revocada' });
      load(role, statusFilter);
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message || 'No se pudo revocar' });
    } finally {
      setActing(null);
    }
  };

  const isMerchant = role === 'merchant';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          <Mail className="h-6 w-6 inline" /> Invitaciones
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Venta en campo: anotás el correo negocio por negocio y les llega la invitación a
          registrarse.
        </p>
      </div>

      {/* Tabs por tipo */}
      <div className="flex gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 p-1">
        {(
          [
            { value: 'merchant', label: 'Kiwi Comercio', Icon: Store },
            { value: 'driver', label: 'Kiwi Repartidores', Icon: Bike },
          ] as const
        ).map((tab) => (
          <motion.button
            key={tab.value}
            onClick={() => {
              setRole(tab.value);
              setLastLink(null);
              setNotice(null);
            }}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              role === tab.value
                ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 shadow-soft'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
            whileTap={{ scale: 0.97 }}
          >
            <tab.Icon className="h-4 w-4" />
            {tab.label}
          </motion.button>
        ))}
      </div>

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

      {/* Link recién generado: única chance de copiarlo (el token no se guarda) */}
      {lastLink && (
        <motion.div
          className="rounded-2xl border border-kiwi-200 dark:border-kiwi-800 bg-kiwi-50 dark:bg-kiwi-900/20 p-4"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm font-medium text-kiwi-700 dark:text-kiwi-300 mb-2">
            {lastLink.emailSent
              ? 'Link enviado por correo (también lo podés copiar):'
              : 'Copiá este link y mandalo manual:'}
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white dark:bg-surface-800 px-3 py-2 text-xs text-surface-700 dark:text-surface-300">
              {lastLink.url}
            </code>
            <button
              onClick={() => copyLink(lastLink.url)}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-kiwi-600 px-3 py-2 text-xs font-semibold text-white hover:bg-kiwi-700"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Formulario de carga en campo */}
      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="flex items-center gap-2 text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-1">
          <Send className="h-5 w-5" />
          {isMerchant ? 'Invitar un comercio' : 'Invitar un repartidor'}
        </h3>
        <p className="text-xs text-surface-500 dark:text-surface-400 mb-4">
          Pedí el correo en el local. El teléfono es opcional (solo para contactarlo después).
        </p>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div className="lg:col-span-2">
            <label
              htmlFor="inv-email"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              Correo *
            </label>
            <input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="soda@ejemplo.com"
              autoComplete="email"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
          <div>
            <label
              htmlFor="inv-phone"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              Teléfono (opcional)
            </label>
            <input
              id="inv-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="8888-8888"
              autoComplete="tel"
              inputMode="tel"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
          <div>
            <label
              htmlFor="inv-name"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              {isMerchant ? 'Negocio (opcional)' : 'Nombre (opcional)'}
            </label>
            <input
              id="inv-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isMerchant ? 'Soda El Sabor' : 'Juan Pérez'}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
            <motion.button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-kiwi-gradient text-white text-sm font-semibold shadow-kiwi-lg disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? 'Enviando…' : 'Enviar invitación'}
            </motion.button>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
          </div>
        </form>
      </motion.div>

      {/* Filtro + lista */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(
            [
              { value: 'pending', label: 'Pendientes' },
              { value: 'accepted', label: 'Aceptadas' },
              { value: 'all', label: 'Todas' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === tab.value
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-surface-500 dark:text-surface-400">{total} en total</p>
      </div>

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
                  Contacto
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Estado
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Carga
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-surface-400">
                    Cargando…
                  </td>
                </tr>
              ) : (
                items.map((inv) => {
                  const s = statusLabel(inv.status);
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <p className="font-medium text-surface-800 dark:text-surface-200">
                          {inv.email}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {[inv.name, inv.phone].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.color}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-surface-500 dark:text-surface-400">
                          {new Date(inv.createdAt).toLocaleDateString('es-CR')}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          {inv.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleResend(inv.id)}
                                disabled={acting === inv.id}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-kiwi-700 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={`h-3.5 w-3.5 ${acting === inv.id ? 'animate-spin' : ''}`}
                                />
                                Reenviar
                              </button>
                              <button
                                onClick={() => handleRevoke(inv.id)}
                                disabled={acting === inv.id}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                Revocar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {!loading && items.length === 0 && (
        <p className="text-center text-sm text-surface-400">
          Sin invitaciones con ese filtro. Cargá la primera arriba.
        </p>
      )}
    </div>
  );
}
