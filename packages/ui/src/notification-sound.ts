// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * 🔔 Motor de sonido de notificaciones (compartido driver + comercio).
 *
 * Sintetiza los pitidos con Web Audio API: sin archivos .mp3, sin hosts
 * nuevos en el CSP y funciona offline. En móviles el AudioContext nace
 * suspendido hasta el primer gesto del usuario: se desbloquea solo con
 * listeners de pointerdown/touchend/keydown (una vez).
 */

export type NotificationSoundKind =
  'new_order' | 'order_update' | 'success' | 'payment' | 'chat' | 'default';

const STORAGE_KEY = 'kiwi_sound_enabled';

let ctx: AudioContext | null = null;
let unlockAttached = false;
const subscribers = new Set<(enabled: boolean) => void>();

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Sin storage: igual se respeta en memoria por sesión
  }
  subscribers.forEach((fn) => fn(enabled));
}

export function subscribeSoundEnabled(fn: (enabled: boolean) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

function ensureUnlockListeners(): void {
  if (unlockAttached || typeof window === 'undefined') return;
  unlockAttached = true;
  const unlock = () => {
    try {
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      else getContext()?.resume?.();
    } catch {
      // Silencio si el navegador no lo permite
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchend', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

interface Tone {
  freq: number;
  at: number;
  dur: number;
  vol?: number;
  type?: OscillatorType;
}

const PATTERNS: Record<NotificationSoundKind, Tone[]> = {
  // Insistente: el repartidor no se puede perder un pedido nuevo
  new_order: [
    { freq: 880, at: 0, dur: 0.16 },
    { freq: 880, at: 0.2, dur: 0.16 },
    { freq: 1174.66, at: 0.4, dur: 0.28 },
  ],
  order_update: [
    { freq: 784, at: 0, dur: 0.14 },
    { freq: 1046.5, at: 0.16, dur: 0.22 },
  ],
  success: [
    { freq: 659.25, at: 0, dur: 0.14 },
    { freq: 987.77, at: 0.15, dur: 0.26 },
  ],
  payment: [
    { freq: 1318.5, at: 0, dur: 0.12 },
    { freq: 1567.98, at: 0.13, dur: 0.24 },
  ],
  chat: [{ freq: 1046.5, at: 0, dur: 0.18 }],
  default: [
    { freq: 880, at: 0, dur: 0.14 },
    { freq: 1174.66, at: 0.16, dur: 0.2 },
  ],
};

function playTone(ac: AudioContext, tone: Tone): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = tone.type ?? 'sine';
  osc.frequency.value = tone.freq;
  const t0 = ac.currentTime + tone.at;
  const vol = tone.vol ?? 0.25;
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + tone.dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + tone.dur + 0.05);
}

/**
 * Suena el patrón indicado. No-ops en SSR, con sonido apagado o si el
 * navegador bloquea el audio: nunca lanza.
 */
export function playNotificationSound(kind: NotificationSoundKind = 'default'): void {
  try {
    if (typeof window === 'undefined' || !isSoundEnabled()) return;
    ensureUnlockListeners();
    const ac = getContext();
    if (!ac) return;
    if (ac.state === 'suspended') {
      void ac.resume().catch(() => undefined);
      if (ac.state === 'suspended') return;
    }
    for (const tone of PATTERNS[kind] ?? PATTERNS.default) {
      playTone(ac, tone);
    }
  } catch {
    // Las notificaciones son visuales primero; el sonido nunca rompe nada
  }
}
