'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOfflinePayments, type CreatePaymentData } from './useOfflinePayments';
import { useNetworkStatus } from './useNetworkStatus';

interface OfflinePaymentFormProps {
  orderId: string;
  merchantId: string;
  merchantName: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  onSuccess?: (payment: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function OfflinePaymentForm({
  orderId,
  merchantId,
  merchantName,
  customerName,
  customerPhone,
  items,
  subtotal,
  deliveryFee,
  onSuccess,
  onError,
  className = '',
}: OfflinePaymentFormProps) {
  const { createPayment, processPayment, unsyncedCount } = useOfflinePayments();
  const { isOnline } = useNetworkStatus();
  
  const [selectedMethod, setSelectedMethod] = useState<'sinpe' | 'card' | 'cash' | 'crypto'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const total = subtotal + deliveryFee;

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Create payment
      const payment = await createPayment({
        orderId,
        merchantId,
        merchantName,
        customerName,
        customerPhone,
        amount: total,
        method: selectedMethod,
        items,
        subtotal,
        deliveryFee,
      });

      // Process payment
      const processedPayment = await processPayment(payment.id);
      
      setReceipt(processedPayment.receipt);
      setPaymentComplete(true);
      onSuccess?.(processedPayment);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Error al procesar pago');
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentComplete && receipt) {
    return (
      <motion.div
        className={`bg-white dark:bg-surface-800 rounded-2xl shadow-soft dark:shadow-dark overflow-hidden ${className}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {/* Success Header */}
        <div className="p-6 bg-kiwi-500 text-white text-center">
          <motion.div
            className="text-5xl mb-3"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            ✅
          </motion.div>
          <h2 className="text-xl font-display font-bold">Pago Completado</h2>
          <p className="text-sm opacity-90 mt-1">
            {isOnline ? 'Sincronizado' : 'Guardado localmente'}
          </p>
        </div>

        {/* Receipt */}
        <div className="p-4">
          <div className="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 font-mono text-sm">
            <div className="text-center mb-4">
              <p className="font-bold text-lg">🥝 KIWI</p>
              <p className="text-xs text-surface-500">Tu app de delivery</p>
            </div>

            <div className="text-center mb-4 text-xs">
              <p>Recibo #{receipt.receiptNumber}</p>
              <p>{new Date(receipt.timestamp).toLocaleString('es-CR')}</p>
            </div>

            <div className="space-y-1 mb-4">
              {receipt.items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between">
                  <span>{item.quantity}x {item.name}</span>
                  <span>₡{item.total.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-surface-300 dark:border-surface-600 pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₡{receipt.subtotal.toLocaleString()}</span>
              </div>
              {receipt.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>Envío</span>
                  <span>₡{receipt.deliveryFee.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>₡{receipt.total.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-center mt-4 text-xs text-surface-500">
              <p>Método: {receipt.paymentMethod.toUpperCase()}</p>
              <p>Cliente: {receipt.customer.name}</p>
            </div>

            {receipt.qrCode && (
              <div className="text-center mt-4">
                <p className="text-xs text-surface-500 mb-1">Código de verificación</p>
                <div className="bg-white dark:bg-surface-800 p-2 rounded inline-block">
                  <div className="w-16 h-16 bg-surface-200 dark:bg-surface-700 rounded flex items-center justify-center">
                    <span className="text-xs">QR</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 space-y-2">
            <button
              onClick={() => window.print()}
              className="w-full py-3 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-medium"
            >
              🖨️ Imprimir Recibo
            </button>
            <button
              onClick={() => {
                setPaymentComplete(false);
                setReceipt(null);
              }}
              className="w-full py-3 rounded-xl bg-kiwi-500 text-white font-medium"
            >
              Nuevo Pago
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`bg-white dark:bg-surface-800 rounded-2xl shadow-soft dark:shadow-dark overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
            💳 Procesar Pago
          </h2>
          {!isOnline && (
            <motion.div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 text-xs font-medium"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span>📡</span>
              <span>Offline</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-4 border-b border-surface-100 dark:border-surface-700">
        <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
          Resumen del pedido
        </h3>
        <div className="space-y-2 text-sm">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between">
              <span className="text-surface-600 dark:text-surface-400">
                {item.quantity}x {item.name}
              </span>
              <span className="font-medium">₡{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
            <span className="text-surface-600 dark:text-surface-400">Envío</span>
            <span className="font-medium">
              {deliveryFee === 0 ? 'Gratis' : `₡${deliveryFee.toLocaleString()}`}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
            <span className="font-semibold text-surface-800 dark:text-surface-200">Total</span>
            <span className="font-bold text-xl text-kiwi-600 dark:text-kiwi-400">
              ₡{total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Method Selection */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
          Método de pago
        </h3>
        <div className="space-y-2">
          {[
            { id: 'cash', label: 'Efectivo', icon: '💵', desc: 'Pagar al repartidor' },
            { id: 'sinpe', label: 'SINPE', icon: '📱', desc: 'Transferencia instantánea' },
            { id: 'card', label: 'Tarjeta', icon: '💳', desc: 'Crédito/Débito' },
            { id: 'crypto', label: 'Crypto', icon: '₿', desc: 'USDC/USDT' },
          ].map((method) => (
            <motion.button
              key={method.id}
              onClick={() => setSelectedMethod(method.id as any)}
              className={`w-full p-4 rounded-xl text-left transition-colors ${
                selectedMethod === method.id
                  ? 'bg-kiwi-50 dark:bg-kiwi-900/30 border-2 border-kiwi-500'
                  : 'bg-surface-50 dark:bg-surface-900 border-2 border-transparent hover:border-surface-200 dark:hover:border-surface-700'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{method.icon}</span>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">
                    {method.label}
                  </p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {method.desc}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Payment Button */}
      <div className="p-4 border-t border-surface-100 dark:border-surface-700">
        <motion.button
          onClick={handlePayment}
          disabled={isProcessing}
          className={`w-full py-4 rounded-xl font-semibold text-lg ${
            isProcessing
              ? 'bg-surface-200 dark:bg-surface-700 text-surface-500'
              : 'bg-kiwi-500 hover:bg-kiwi-600 text-white'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⏳
              </motion.span>
              Procesando...
            </span>
          ) : (
            `💳 Pagar ₡${total.toLocaleString()}`
          )}
        </motion.button>

        {!isOnline && (
          <p className="text-xs text-center text-orange-500 mt-2">
            📡 El pago se procesará localmente y se sincronizará cuando vuelva la conexión
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Payment receipt component
 */
export function PaymentReceipt({
  payment,
  className = '',
}: {
  payment: any;
  className?: string;
}) {
  const receipt = payment.receipt;

  return (
    <div className={`bg-white dark:bg-surface-800 rounded-2xl shadow-soft dark:shadow-dark overflow-hidden ${className}`}>
      <div className="p-4 bg-kiwi-500 text-white text-center">
        <p className="font-bold text-lg">🥝 KIWI</p>
        <p className="text-xs opacity-90">Tu app de delivery</p>
      </div>

      <div className="p-4">
        <div className="text-center mb-4">
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
            Recibo #{receipt.receiptNumber}
          </p>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {new Date(receipt.timestamp).toLocaleString('es-CR')}
          </p>
        </div>

        <div className="space-y-2 text-sm mb-4">
          {receipt.items.map((item: any, index: number) => (
            <div key={index} className="flex justify-between">
              <span className="text-surface-600 dark:text-surface-400">
                {item.quantity}x {item.name}
              </span>
              <span className="font-medium">₡{item.total.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-surface-200 dark:border-surface-700 pt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-surface-600 dark:text-surface-400">Subtotal</span>
            <span>₡{receipt.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-surface-600 dark:text-surface-400">Envío</span>
            <span>{receipt.deliveryFee === 0 ? 'Gratis' : `₡${receipt.deliveryFee.toLocaleString()}`}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-surface-200 dark:border-surface-700">
            <span>Total</span>
            <span className="text-kiwi-600 dark:text-kiwi-400">₡{receipt.total.toLocaleString()}</span>
          </div>
        </div>

        <div className="text-center mt-4 text-xs text-surface-500 dark:text-surface-400">
          <p>Método: {receipt.paymentMethod.toUpperCase()}</p>
          <p>Cliente: {receipt.customer.name}</p>
        </div>
      </div>
    </div>
  );
}
