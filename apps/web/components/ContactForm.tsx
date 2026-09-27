// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { resolveApiUrl } from '@kiwi/ui';

const SUBJECTS = [
  { id: 'general', label: 'Consulta general' },
  { id: 'merchant', label: 'Quiero mi comercio en Kiwi' },
  { id: 'driver', label: 'Quiero ser repartidor' },
  { id: 'support', label: 'Soporte / problema' },
] as const;

const inputClass =
  'w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-sm text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState<string>('general');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const valid =
    name.trim().length >= 2 &&
    message.trim().length >= 10 &&
    (email.trim() !== '' || phone.trim() !== '') &&
    (email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || status === 'sending') return;

    setStatus('sending');
    setErrorMsg(null);
    try {
      // resolveApiUrl: /api/... 404 en prod (no hay rewrite de Next) —
      // apunta al API real (NEXT_PUBLIC_API_URL). El body va trim-eado para
      // espejar la validación del DTO (el server también trims, pero no
      // dependemos de eso para el contenido que muestra el success card).
      const res = await fetch(resolveApiUrl('/api/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          subject,
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const detail = Array.isArray(body?.message) ? body!.message[0] : body?.message;
        throw new Error(detail ?? 'No pudimos enviar tu mensaje. Intenta de nuevo.');
      }
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos enviar tu mensaje.');
    }
  };

  if (status === 'sent') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-kiwi-200 dark:border-kiwi-800 bg-kiwi-50 dark:bg-kiwi-900/30 p-8 text-center"
      >
        <CheckCircle2 className="h-12 w-12 text-kiwi-700 dark:text-kiwi-400 mx-auto mb-4" />
        <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-2">
          ¡Mensaje enviado!
        </h3>
        <p className="text-sm text-surface-600 dark:text-surface-300">
          Te respondemos pronto al {email ? 'correo' : 'teléfono'} que nos dejaste.
        </p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800/50 p-6 space-y-4"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="contact-name"
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
          >
            Nombre *
          </label>
          <input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            maxLength={80}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="contact-subject"
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
          >
            Motivo
          </label>
          <select
            id="contact-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClass}
          >
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="contact-email"
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
          >
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            maxLength={120}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="contact-phone"
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
          >
            Teléfono
          </label>
          <input
            id="contact-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="8888-1234"
            maxLength={20}
            className={inputClass}
          />
        </div>
      </div>

      <p className="text-xs text-surface-500 dark:text-surface-400 -mt-1">
        Deja al menos un email o teléfono para poder responderte.
      </p>

      <div>
        <label
          htmlFor="contact-message"
          className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Mensaje *
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Cuéntanos en qué podemos ayudarte…"
          rows={4}
          maxLength={2000}
          required
          className={inputClass}
        />
        <p className="text-xs text-surface-400 mt-1 text-right">{message.length}/2000</p>
      </div>

      {status === 'error' && errorMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || status === 'sending'}
        className="w-full rounded-xl bg-kiwi-700 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-kiwi-800"
      >
        {status === 'sending' ? (
          <>
            <Loader2 className="h-4 w-4 inline animate-spin" /> Enviando…
          </>
        ) : (
          <>
            <Send className="h-4 w-4 inline" /> Enviar mensaje
          </>
        )}
      </button>
    </form>
  );
}
