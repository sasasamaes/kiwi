// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CreditCard, Smartphone } from 'lucide-react';
import { safeNavigateToUrl } from './utils';

export interface OnvoPayCheckoutProps {
  paymentIntentId: string;
  clientSecret: string;
  checkoutUrl?: string;
  amount: number;
  currency?: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export function OnvoPayCheckout({
  paymentIntentId,
  clientSecret,
  checkoutUrl,
  amount,
  currency = 'CRC',
  onSuccess,
  onError,
  onCancel,
}: OnvoPayCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to OnvoPay checkout or use embedded form
  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      if (checkoutUrl) {
        // Redirect solo a checkout https allow-listed (safeNavigateToUrl lanza
        // vía el if y la validación vive en el helper).
        if (!safeNavigateToUrl(checkoutUrl)) {
          throw new Error('URL de pago inválida');
        }
      } else {
        // Sin checkoutUrl no hay a dónde redirigir: error visible y NUNCA
        // éxito simulado (antes un setTimeout marcaba como pagado un pedido
        // impago tras 2s).
        throw new Error('No se pudo iniciar el pago. Intentá de nuevo o elegí otro método.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar el pago';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="rounded-2xl glass p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">
          <CreditCard className="h-10 w-10" />
        </div>
        <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
          Pago Seguro con OnvoPay
        </h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Serás redirigido para completar el pago
        </p>
      </div>

      {/* Amount Summary */}
      <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-surface-600 dark:text-surface-400">Total a pagar</span>
          <span className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-400">
            ₡{amount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="rounded-xl bg-red-50 dark:bg-red-900/30 p-4 mb-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Button */}
      <motion.button
        className="w-full py-4 px-6 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleCheckout}
        disabled={loading}
        whileTap={{ scale: 0.98 }}
        whileHover={{ scale: 1.02 }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Clock className="h-4 w-4" />
            </motion.span>
            Procesando...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Pagar Ahora
          </span>
        )}
      </motion.button>

      {/* Cancel Button */}
      <button
        className="w-full mt-3 py-2 px-4 rounded-xl text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        onClick={onCancel}
        disabled={loading}
      >
        Cancelar
      </button>

      {/* Security Note */}
      <div className="mt-4 text-center">
        <p className="text-xs text-surface-500 dark:text-surface-400">
          🔒 Pago seguro y encriptado por OnvoPay
        </p>
      </div>
    </motion.div>
  );
}

export interface CryptoCheckoutProps {
  walletAddress: string;
  amount: number;
  amountInCrypto: number;
  coin: 'USDC' | 'USDT';
  qrCode?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function CryptoCheckout({
  walletAddress,
  amount,
  amountInCrypto,
  coin,
  qrCode,
  onSuccess,
  onError,
}: CryptoCheckoutProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    // Clipboard falla en iOS no-HTTPS o sin permiso: solo mostrar "¡Copiado!"
    // si el write tuvo éxito real.
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiá la dirección:', walletAddress);
    }
  };

  return (
    <motion.div
      className="rounded-2xl glass p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">💎</div>
        <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
          Pago con {coin}
        </h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Envía exactamente el monto indicado
        </p>
      </div>

      {/* Amount to Pay */}
      <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4 mb-4">
        <div className="text-center">
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Monto a enviar</p>
          <p className="text-2xl font-bold text-kiwi-700 dark:text-kiwi-400">
            {amountInCrypto.toFixed(6)} {coin}
          </p>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            ≈ ₡{amount.toLocaleString()} CRC
          </p>
        </div>
      </div>

      {/* QR Code */}
      {qrCode && (
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-white rounded-xl shadow-soft max-w-full">
            {qrCode.startsWith('data:') || qrCode.startsWith('http') ? (
              <img src={qrCode} alt="QR de pago" className="w-48 h-48 rounded-lg" />
            ) : (
              <p className="w-48 break-all rounded-lg bg-surface-100 dark:bg-surface-700 p-3 font-mono text-[11px] text-surface-700 dark:text-surface-200">
                {qrCode}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Wallet Address */}
      <div className="mb-4">
        <p className="text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
          Dirección de envío
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={walletAddress}
            readOnly
            className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-4 py-3 text-sm font-mono text-surface-800 dark:text-surface-100"
          />
          <motion.button
            className="px-4 py-3 rounded-xl bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 font-medium"
            onClick={copyAddress}
            whileTap={{ scale: 0.95 }}
          >
            {copied ? 'Check' : 'clipboard'}
          </motion.button>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 p-4">
        <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
          Instrucciones
        </h4>
        <ol className="text-sm text-blue-600 dark:text-blue-300 space-y-1 list-decimal list-inside">
          <li>Abre tu billetera {coin}</li>
          <li>
            Envía exactamente {amountInCrypto.toFixed(6)} {coin}
          </li>
          <li>A la dirección mostrada arriba</li>
          <li>Volvé acá y avisanos que ya lo enviaste</li>
        </ol>
      </div>

      <motion.button
        className="mt-4 w-full py-3 rounded-xl bg-kiwi-700 text-white font-semibold"
        onClick={onSuccess}
        whileTap={{ scale: 0.98 }}
      >
        Ya envié el pago
      </motion.button>
      <p className="mt-2 text-center text-xs text-surface-500 dark:text-surface-400">
        Lo verificamos y te avisamos cuando se confirme en la red.
      </p>

      {/* Network Info */}
      <div className="mt-4 text-center">
        <p className="text-xs text-surface-500 dark:text-surface-400">
          🔗 Red: Stellar{' '}
          {process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'testnet' ? 'Testnet' : 'Mainnet'}
        </p>
      </div>
    </motion.div>
  );
}
