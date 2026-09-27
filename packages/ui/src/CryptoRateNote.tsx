// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { api } from './api-client';

interface CryptoRateNoteProps {
  /** Total del pedido en CRC que se pretende pagar en stablecoin. */
  amountCRC: number;
  /** Stablecoin elegida. Default USDC. */
  coin?: 'USDC' | 'USDT';
  /** Clase extra para el contenedor. */
  className?: string;
}

interface RateResponse {
  usdCrc: number;
  source: string;
}

/**
 * Transparencia de precio en el checkout crypto: muestra la tasa CRC/USD
 * vigente y la conversión estimada del total a USDC/USDT ANTES de pagar.
 * La fuente de verdad es el mismo oracle del backend (Hacienda CR → er-api
 * → stale → constante), expuesto en /payments/crypto/rate.
 *
 * Nota: la conversión final la calcula el servidor al crear el cobro; esta
 * nota es informativa y lo dice así para no prometer cifras exactas.
 */
export function CryptoRateNote({ amountCRC, coin = 'USDC', className }: CryptoRateNoteProps) {
  // Cache de sesión: una consulta por carga de página y moneda, refresco a los 5 min.
  const key = coin;
  const [rate, setRate] = useState<RateResponse | null>(() => fetchedRate.get(key) ?? null);
  const [state, setState] = useState<'ok' | 'loading' | 'error'>('loading');

  const cached = fetchedRate.get(key);
  const cachedAt = fetchedAt.get(key);

  useEffect(() => {
    if (cached && Date.now() - (cachedAt ?? 0) < 5 * 60 * 1000) {
      setRate(cached);
      setState('ok');
      return;
    }
    let alive = true;
    api
      .getCryptoRate()
      .then((r) => {
        if (!alive) return;
        fetchedRate.set(key, r);
        fetchedAt.set(key, Date.now());
        setRate(r);
        setState('ok');
      })
      .catch(() => {
        if (alive) setState('error');
      });
    return () => {
      alive = false;
    };
  }, [key, cached, cachedAt]);

  if (state === 'error') return null; // falla silenciosa: es información, no algo crítico

  const usdCrc = rate?.usdCrc;
  const amountCoin =
    usdCrc && Number.isFinite(amountCRC) && amountCRC > 0 ? amountCRC / usdCrc : null;

  return (
    <p className={`text-center text-xs text-surface-500 dark:text-surface-400 ${className ?? ''}`}>
      {state === 'loading' || !usdCrc ? (
        <span>Consultando tipo de cambio…</span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3 w-3" aria-hidden="true" />
          Tasa hoy: ₡{usdCrc.toLocaleString('es-CR', { maximumFractionDigits: 2 })} = 1 USD ·{' '}
          {amountCoin ? (
            <>
              ≈{' '}
              <strong>
                {amountCoin.toFixed(2)} {coin}
              </strong>{' '}
              por tu pedido de ₡{Math.round(amountCRC).toLocaleString('es-CR')}
            </>
          ) : (
            <>fuente: {rate?.source === 'hacienda' ? 'Hacienda CR' : 'er-api'}</>
          )}
        </span>
      )}
      {amountCoin && (
        <span className="block mt-0.5 text-surface-400">
          Conversión estimada; el cobro final lo calcula el servidor al procesar el pago.
        </span>
      )}
    </p>
  );
}

// Cache de sesión (módulo): evita re-fetch al re-renderizar o volver al checkout.
const fetchedRate = new Map<string, RateResponse>();
const fetchedAt = new Map<string, number>();
