// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { api } from './api-client';
import { socketClient } from './socket-client';
import { useAuth } from './AuthContext';
import { useTranslations } from './LanguageProvider';

export interface ChatMessage {
  id: string;
  senderId: string | null;
  senderRole: string | null;
  text: string;
  createdAt: string;
  mine: boolean;
}

/**
 * Chat del pedido (comercio ↔ repartidor ↔ cliente dueño). Historial por
 * REST + vivo por socket + relectura periódica por si se perdió algo.
 * Sin contraparte con cuenta (pedido invitado sin repartidor) muestra aviso.
 */
export function OrderChat({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const { t } = useTranslations();
  const myId = (user as any)?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Array<{ role: string; present: boolean }>>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getOrderMessages(orderId);
      if (Array.isArray(res?.messages)) setMessages(res.messages);
      if (Array.isArray(res?.participants)) setParticipants(res.participants);
      setDenied(false);
    } catch (e: any) {
      if (e?.status === 403 || e?.status === 404) setDenied(true);
    }
  }, [orderId]);

  useEffect(() => {
    setMessages([]);
    setDenied(false);
    load();
  }, [load]);

  // Vivo por socket + relectura cada 15s por si se perdió un evento.
  useEffect(() => {
    const off = socketClient.on('chat:message', (m: any) => {
      if (!m || m.orderId !== orderId) return;
      const key = m.messageId ?? m.id;
      setMessages((prev) => {
        if (prev.some((x) => (x as any).messageId === key || x.id === key)) return prev;
        return [
          ...prev,
          {
            id: key,
            senderId: m.senderId ?? null,
            senderRole: m.senderRole ?? null,
            text: String(m.text ?? ''),
            createdAt: m.createdAt ?? new Date().toISOString(),
            mine: myId != null && m.senderId === myId,
          },
        ];
      });
    });
    const t = setInterval(() => void load(), 15000);
    return () => {
      off();
      clearInterval(t);
    };
  }, [orderId, myId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.sendOrderMessage(orderId, body);
      const m = res?.message;
      if (m) {
        const key = m.messageId ?? m.id;
        setMessages((prev) =>
          prev.some((x) => x.id === key) ? prev : [...prev, { ...m, id: key, mine: true }],
        );
      } else {
        await load();
      }
      setText('');
    } catch (e: any) {
      setError(e?.message || t('wdrvwork.common.chatSendFailed'));
    } finally {
      setSending(false);
    }
  };

  if (denied) return null;

  const senderLabel = (m: ChatMessage) => {
    if (m.mine) return t('wdrvwork.common.chatYou');
    const role = m.senderRole;
    return role === 'merchant' || role === 'driver' || role === 'customer'
      ? t(`wdrvwork.common.chatRole${role[0].toUpperCase()}${role.slice(1)}`)
      : t('wdrvwork.common.chatUser');
  };

  const counterpartMissing =
    participants.length > 0 &&
    !participants.some((p) => p.present && (p.role === 'driver' || p.role === 'customer'));

  return (
    <div className="rounded-2xl border border-surface-200/60 dark:border-white/[0.06] bg-surface-50 dark:bg-surface-900/50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-surface-500 dark:text-surface-400">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {t('wdrvwork.common.chatTitle')}
      </p>
      {counterpartMissing && (
        <p className="mb-2 text-xs text-surface-500 dark:text-surface-400">
          {t('wdrvwork.common.chatMissing')}
        </p>
      )}
      {messages.length > 0 && (
        <div className="mb-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                  m.mine
                    ? 'bg-kiwi-600 text-white'
                    : 'bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 border border-surface-200/60 dark:border-white/[0.06]'
                }`}
              >
                {!m.mine && (
                  <p className="text-[10px] font-semibold opacity-70">{senderLabel(m)}</p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
          placeholder={t('wdrvwork.common.chatPlaceholder')}
          maxLength={1000}
          className="min-w-0 flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
        />
        <button
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          aria-label={t('wdrvwork.common.chatSend')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-kiwi-600 text-white disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
