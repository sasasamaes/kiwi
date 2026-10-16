// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Send, Loader2, Mail, MessageCircle, Eye } from 'lucide-react';
import { api } from '@kiwi/ui';

type Channel = 'email' | 'whatsapp' | 'both';

interface Template {
  id: string;
  role: string;
  label: string;
  subject: string;
  body: string;
  registerUrl: string;
}

interface Log {
  id: string;
  channel: string;
  audience: string;
  subject: string | null;
  preview: string | null;
  count: number;
  failed: number;
  createdAt: string;
}

const ROLES = [
  { value: 'merchant', label: 'Comercios' },
  { value: 'driver', label: 'Repartidores' },
  { value: 'customer', label: 'Clientes' },
];

export default function DifusionPage() {
  const [channel, setChannel] = useState<Channel>('email');
  const [roles, setRoles] = useState<string[]>(['merchant']);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [extraEmails, setExtraEmails] = useState('');
  const [extraPhones, setExtraPhones] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [channels, setChannels] = useState<{
    smtp: { configured: boolean; verified: boolean; error?: string };
    whatsapp: { configured: boolean; infoTemplate: string | null };
  } | null>(null);

  useEffect(() => {
    api
      .getMarketingTemplates()
      .then((r) => setTemplates(r?.templates ?? []))
      .catch(() => undefined);
    api
      .getBroadcastHistory(20)
      .then((r) => setLogs(r?.logs ?? []))
      .catch(() => undefined);
    api
      .getChannelsStatus()
      .then((r) => setChannels(r))
      .catch(() => undefined);
  }, []);

  const toggleRole = (v: string) =>
    setRoles((prev) => (prev.includes(v) ? prev.filter((r) => r !== v) : [...prev, v]));

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(t.subject);
    setBody(t.body);
    setRoles([t.role]);
  };

  const payload = () => ({
    channel,
    roles,
    extraEmails: extraEmails
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    extraPhones: extraPhones
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    subject: subject.trim(),
    body,
  });

  const handlePreview = async () => {
    setCounting(true);
    setResult(null);
    try {
      const r = await api.previewBroadcast(payload());
      setCount(r.count);
    } catch (e: any) {
      setResult({ ok: false, text: e?.message || 'No se pudo contar' });
    } finally {
      setCounting(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setResult({ ok: false, text: 'Faltan asunto y mensaje' });
      return;
    }
    const who =
      channel === 'email'
        ? 'por correo'
        : channel === 'whatsapp'
          ? 'por WhatsApp'
          : 'por correo y WhatsApp';
    if (!window.confirm(`¿Enviar ${who} a ${count ?? 'los destinatarios'}?`)) return;
    setSending(true);
    setResult(null);
    try {
      const r = await api.sendMarketingBroadcast(payload());
      setResult({
        ok: r.failed === 0,
        text: `Enviados ${r.sent}${r.failed ? `, fallaron ${r.failed}${r.error ? `: ${r.error}` : ' (¿SMTP/Kapso configurados?)'}` : ''}.`,
      });
      api
        .getBroadcastHistory(20)
        .then((h) => setLogs(h?.logs ?? []))
        .catch(() => undefined);
    } catch (e: any) {
      setResult({ ok: false, text: e?.message || 'No se pudo enviar' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
          <Megaphone className="h-6 w-6 inline" /> Difusión
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Correos y WhatsApp informativos para que entiendan cómo funciona Kiwi.
        </p>
      </div>

      {result && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            result.ok
              ? 'bg-kiwi-50 dark:bg-kiwi-900/30 border-kiwi-200 dark:border-kiwi-800 text-kiwi-700 dark:text-kiwi-300'
              : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
          }`}
        >
          {result.text}
        </div>
      )}

      {/* Estado real de los canales (diagnóstico del API, no adivinanza) */}
      {channels && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`px-3 py-1.5 rounded-full font-medium ${
              channels.smtp.verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}
            title={channels.smtp.error ?? 'SMTP verificado'}
          >
            📧 SMTP: {channels.smtp.verified ? 'verificado ✓' : 'con problema ✗'}
            {!channels.smtp.verified && channels.smtp.error ? ` — ${channels.smtp.error}` : ''}
            {!channels.smtp.configured && ' (sin configurar)'}
          </span>
          <span
            className={`px-3 py-1.5 rounded-full font-medium ${
              channels.whatsapp.configured
                ? 'bg-green-100 text-green-700'
                : 'bg-surface-100 text-surface-500'
            }`}
          >
            💬 Kapso: {channels.whatsapp.configured ? 'configurado' : 'sin configurar'}
            {channels.whatsapp.configured &&
              ` · plantilla info: ${channels.whatsapp.infoTemplate ?? 'no'}`}
          </span>
        </div>
      )}

      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Canal */}
        <div className="flex gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 p-1">
          {(
            [
              { value: 'email', label: 'Correo', Icon: Mail },
              { value: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
              { value: 'both', label: 'Ambos', Icon: Send },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setChannel(t.value)}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                channel === t.value
                  ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 shadow-soft'
                  : 'text-surface-500 dark:text-surface-400'
              }`}
            >
              <t.Icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
        {channel !== 'email' && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            WhatsApp a contactos fríos exige plantilla aprobada en Kapso (KAPSO_TEMPLATE_INFO). Sin
            plantilla solo llega si hay conversación abierta de 24h.
          </p>
        )}

        {/* Audiencia */}
        <div>
          <p className="mb-2 text-xs font-medium text-surface-600 dark:text-surface-400">
            Audiencia (usuarios registrados)
          </p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => toggleRole(r.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  roles.includes(r.value)
                    ? 'bg-kiwi-700 text-white'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Plantilla */}
        <div>
          <label
            htmlFor="tpl"
            className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
          >
            Plantilla informativa (opcional)
          </label>
          <select
            id="tpl"
            onChange={(e) => applyTemplate(e.target.value)}
            defaultValue=""
            className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
          >
            <option value="">Escribir manual…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="subj"
            className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
          >
            Asunto {channel !== 'email' && '(primera línea del WhatsApp)'}
          </label>
          <input
            id="subj"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Cómo funciona Kiwi para tu comercio"
            className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
          />
        </div>

        <div>
          <label
            htmlFor="msg"
            className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
          >
            Mensaje ({'{{name}}'} = nombre, {'{{registerUrl}}'} = link de registro)
          </label>
          <textarea
            id="msg"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="extra-emails"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              Emails extra (uno por línea)
            </label>
            <textarea
              id="extra-emails"
              value={extraEmails}
              onChange={(e) => setExtraEmails(e.target.value)}
              rows={3}
              placeholder="soda@ejemplo.com"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
          <div>
            <label
              htmlFor="extra-phones"
              className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400"
            >
              Teléfonos extra WhatsApp (uno por línea)
            </label>
            <textarea
              id="extra-phones"
              value={extraPhones}
              onChange={(e) => setExtraPhones(e.target.value)}
              rows={3}
              placeholder="8888-8888"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={counting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 disabled:opacity-50"
          >
            {counting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Contar destinatarios
          </button>
          {count != null && (
            <span className="text-sm text-surface-600 dark:text-surface-300">
              Llega a <b>{count}</b>
            </span>
          )}
          <motion.button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-kiwi-gradient text-white text-sm font-semibold shadow-kiwi-lg disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Enviando…' : 'Enviar difusión'}
          </motion.button>
        </div>
      </motion.div>

      {/* Historial */}
      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
          Historial de envíos
        </h3>
        {logs.length === 0 ? (
          <p className="text-sm text-surface-400">Todavía no se envió nada.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface-50 dark:bg-surface-700/50 px-4 py-3 text-sm"
              >
                <span className="font-medium text-surface-800 dark:text-surface-200">
                  {l.channel === 'email' ? '📧' : l.channel === 'whatsapp' ? '💬' : '📧💬'}{' '}
                  {l.subject || '(sin asunto)'}
                </span>
                <span className="text-xs text-surface-500">
                  {l.audience} · {l.count} enviados{l.failed ? ` · ${l.failed} fallaron` : ''} ·{' '}
                  {new Date(l.createdAt).toLocaleDateString('es-CR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
