// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils';
import { api } from './api-client';
import {
  Smartphone,
  CreditCard,
  DollarSign,
  AlertTriangle,
  Loader,
  Copy,
  Check,
  Lock,
  Info,
} from 'lucide-react';

export type PaymentMethod =
  'onvopay_sinpe' | 'onvopay_card' | 'crypto_usdc' | 'crypto_usdt' | 'cash';

interface PaymentOption {
  id: PaymentMethod;
  name: string;
  icon: string;
  description: string;
  type: 'fiat' | 'crypto' | 'cash';
}

interface CryptoQuote {
  amountCRC: number;
  amountUSD: number;
  amountCrypto: number;
  rate: number;
}

interface PaymentSelectorProps {
  selected: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  amount: number;
  onCryptoQuote?: (quote: CryptoQuote) => void;
}

const paymentOptions: PaymentOption[] = [
  {
    id: 'onvopay_sinpe',
    name: 'SINPE Móvil',
    icon: 'sinpe',
    description: 'Transferencia instantánea',
    type: 'fiat',
  },
  {
    id: 'onvopay_card',
    name: 'Tarjeta',
    icon: 'card',
    description: 'Crédito o débito',
    type: 'fiat',
  },
  {
    id: 'crypto_usdc',
    name: 'USDC',
    icon: 'usdc',
    description: 'Stablecoin USD (Stellar)',
    type: 'crypto',
  },
  {
    id: 'crypto_usdt',
    name: 'USDT',
    icon: 'usdt',
    description: 'Tether USD (Stellar)',
    type: 'crypto',
  },
  {
    id: 'cash',
    name: 'Efectivo',
    icon: 'cash',
    description: 'Pagar al repartidor',
    type: 'cash',
  },
];

export function PaymentSelector({
  selected,
  onSelect,
  amount,
  onCryptoQuote,
}: PaymentSelectorProps) {
  const [cryptoQuote, setCryptoQuote] = useState<CryptoQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [showCryptoDetails, setShowCryptoDetails] = useState(false);

  useEffect(() => {
    if (selected?.startsWith('crypto_') && amount > 0) {
      fetchCryptoQuote();
    }
  }, [selected, amount]);

  const fetchCryptoQuote = async () => {
    setLoadingQuote(true);
    try {
      // Real server quote (was a hardcoded rate=510 mock in prod).
      const coin = selected === 'crypto_usdc' ? 'USDC' : 'USDT';
      const serverQuote = await api.getCryptoQuote(amount, coin as 'USDC' | 'USDT');

      const quote: CryptoQuote = {
        amountCRC: serverQuote.amountCRC,
        amountUSD: serverQuote.amountUSD,
        amountCrypto: serverQuote.amountCrypto,
        rate: serverQuote.rate,
      };

      setCryptoQuote(quote);
      onCryptoQuote?.(quote);
    } catch (error) {
      // No fictional fallback: showing a mock rate as real money is worse
      // than showing nothing.
      console.error('Failed to get crypto quote:', error);
      setCryptoQuote(null);
    } finally {
      setLoadingQuote(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Payment Methods */}
      <div className="space-y-2">
        {paymentOptions.map((option) => (
          <motion.button
            key={option.id}
            className={cn(
              'w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all',
              selected === option.id
                ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30'
                : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-surface-300 dark:hover:border-surface-600',
            )}
            onClick={() => onSelect(option.id)}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">
                {option.id === 'onvopay_sinpe' && <Smartphone className="h-6 w-6" />}
                {option.id === 'onvopay_card' && <CreditCard className="h-6 w-6" />}
                {(option.id === 'crypto_usdc' || option.id === 'crypto_usdt') && (
                  <DollarSign className="h-6 w-6" />
                )}
                {option.id === 'cash' && <DollarSign className="h-6 w-6" />}
              </span>
              <div className="text-left">
                <p className="font-medium text-surface-800 dark:text-surface-200">{option.name}</p>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  {option.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {option.type === 'crypto' && (
                <span className="px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-xs font-medium text-purple-700 dark:text-purple-400">
                  Crypto
                </span>
              )}
              {selected === option.id && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-kiwi-500 text-xl"
                >
                  ✓
                </motion.span>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Crypto Details */}
      <AnimatePresence>
        {selected?.startsWith('crypto_') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4">
              <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-3">
                Pago con Cripto
              </h4>

              {loadingQuote ? (
                <div className="flex items-center justify-center py-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader className="h-6 w-6 text-surface-500 dark:text-surface-400" />
                  </motion.div>
                </div>
              ) : cryptoQuote ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-600 dark:text-purple-400">Monto en colones</span>
                    <span className="font-medium text-surface-800 dark:text-surface-200">
                      ₡{cryptoQuote.amountCRC.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-600 dark:text-purple-400">Equivalente USD</span>
                    <span className="font-medium text-surface-800 dark:text-surface-200">
                      ${cryptoQuote.amountUSD.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-purple-200 dark:border-purple-800 pt-3">
                    <span className="text-purple-700 dark:text-purple-300 font-medium">
                      {selected === 'crypto_usdc' ? 'USDC' : 'USDT'} a enviar
                    </span>
                    <span className="font-bold text-purple-700 dark:text-purple-300">
                      {cryptoQuote.amountCrypto.toFixed(6)}{' '}
                      {selected === 'crypto_usdc' ? 'USDC' : 'USDT'}
                    </span>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    Envia exactamente este monto a la direccion que se mostrara despues
                  </p>
                </div>
              ) : null}

              <motion.button
                className="mt-3 w-full py-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-sm font-medium"
                onClick={() => setShowCryptoDetails(!showCryptoDetails)}
                whileTap={{ scale: 0.98 }}
              >
                {showCryptoDetails ? 'Ocultar detalles' : 'Ver instrucciones de pago'}
              </motion.button>

              <AnimatePresence>
                {showCryptoDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 space-y-2"
                  >
                    <div className="bg-white dark:bg-surface-800 rounded-lg p-3">
                      <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Red</p>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        Stellar
                      </p>
                    </div>
                    <div className="bg-white dark:bg-surface-800 rounded-lg p-3">
                      <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Activo</p>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        {selected === 'crypto_usdc' ? 'USDC' : 'USDT'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-surface-800 rounded-lg p-3">
                      <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">
                        Importante
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Solo envia {selected === 'crypto_usdc' ? 'USDC' : 'USDT'} por la red
                        Stellar. Enviar otros tokens puede resultar en perdida permanente.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Crypto QR Code component
interface CryptoQRProps {
  address: string;
  amount: number;
  coin: 'USDC' | 'USDT';
}

export function CryptoQR({ address, amount, coin }: CryptoQRProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    // Clipboard falla en iOS no-HTTPS o sin permiso: solo mostrar "¡Copiado!"
    // si el write tuvo éxito real.
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiá la dirección:', address);
    }
  };

  return (
    <div className="rounded-xl glass p-6 text-center">
      <h4 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
        Escanea para pagar
      </h4>

      {/* QR Code Placeholder */}
      <div className="mx-auto w-48 h-48 bg-surface-100 dark:bg-surface-700 rounded-xl flex items-center justify-center mb-4">
        <div className="text-center">
          <Smartphone className="h-16 w-16 text-surface-500 dark:text-surface-400" />
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">QR Code</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Enviar exactamente</p>
        <p className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-400">
          {amount.toFixed(6)} {coin}
        </p>
      </div>

      <div className="mb-4">
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Dirección</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={address}
            readOnly
            className="flex-1 px-3 py-2 bg-surface-50 dark:bg-surface-900 rounded-lg text-xs font-mono text-surface-600 dark:text-surface-400"
          />
          <motion.button
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              copied
                ? 'bg-kiwi-100 text-kiwi-700'
                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
            }`}
            onClick={copyAddress}
            whileTap={{ scale: 0.95 }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </motion.button>
        </div>
      </div>

      <div className="text-xs text-surface-500 dark:text-surface-400 space-y-1">
        <p className="flex items-center gap-1">
          <Lock className="h-3 w-3" /> La confirmacion tarda ~1 minuto
        </p>
        <p className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Envia solo {coin} por la red Stellar
        </p>
      </div>
    </div>
  );
}
