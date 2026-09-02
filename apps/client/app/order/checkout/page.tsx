'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton, PaymentSelector } from '@kiwi/ui';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

type PaymentMethod = 'sinpe' | 'card' | 'cash' | 'crypto_usdc' | 'crypto_usdt';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sinpe');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    const itemsParam = searchParams.get('items');
    if (itemsParam) {
      try {
        setCart(JSON.parse(itemsParam));
      } catch {
        setCart([]);
      }
    }
  }, [searchParams]);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = 0; // Free delivery
  const total = subtotal + deliveryFee;

  const placeOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          paymentMethod,
          address,
          notes,
          total,
        }),
      });
      if (response.ok) {
        setOrderPlaced(true);
      }
    } catch (error) {
      console.error('Error placing order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (orderPlaced) {
    return (
      <main className="min-h-screen bg-bg-light dark:bg-surface-950 flex items-center justify-center p-4">
        <motion.div 
          className="max-w-md w-full text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div 
            className="text-8xl mb-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          >
            ✅
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            ¡Pedido Recibido!
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mb-8">
            Tu pedido está siendo preparado
          </p>
          
          <div className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark mb-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Número de pedido</span>
                <span className="font-semibold text-surface-800 dark:text-surface-200">#KIWI-1234</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Tiempo estimado</span>
                <span className="font-semibold text-kiwi-600 dark:text-kiwi-400">25-35 min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Total</span>
                <span className="font-bold text-surface-800 dark:text-surface-200">₡{total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link href={`/tracking/order-1234`}>
              <AnimatedButton variant="gradient" className="w-full">
                📍 Rastrear Pedido
              </AnimatedButton>
            </Link>
            <Link href="/">
              <AnimatedButton variant="ghost" className="w-full">
                ← Volver al inicio
              </AnimatedButton>
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-light dark:bg-surface-950 pb-32">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">Checkout</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Cart Summary */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            🛒 Tu Pedido
          </h3>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.image}</span>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-200">{item.name}</p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">x{item.quantity}</p>
                  </div>
                </div>
                <p className="font-semibold text-surface-800 dark:text-surface-200">
                  ₡{(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Delivery Address */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            📍 Dirección de Entrega
          </h3>
          <input
            type="text"
            placeholder="¿A dónde lo llevamos?"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
          />
        </motion.div>

        {/* Payment Method */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <PaymentSelector 
            selected={paymentMethod}
            onSelect={setPaymentMethod}
            total={total}
          />
        </motion.div>

        {/* Special Notes */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            📝 Notas Especiales
          </h3>
          <textarea
            placeholder="¿Alguna instrucción especial? (ej: sin cebolla, extra salsa...)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-500 resize-none"
          />
        </motion.div>

        {/* Order Summary */}
        <motion.div 
          className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-surface-500 dark:text-surface-400">Subtotal</span>
              <span className="text-surface-800 dark:text-surface-200">₡{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500 dark:text-surface-400">Envío</span>
              <span className="text-kiwi-600 dark:text-kiwi-400 font-medium">Gratis 🎉</span>
            </div>
            <div className="border-t border-surface-200 dark:border-surface-700 pt-3">
              <div className="flex justify-between">
                <span className="font-semibold text-surface-800 dark:text-surface-200">Total</span>
                <span className="text-xl font-bold text-surface-800 dark:text-surface-200">
                  ₡{total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Place Order Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-t border-surface-200/50 dark:border-surface-700/50">
        <div className="mx-auto max-w-lg">
          <AnimatedButton 
            variant="gradient" 
            size="lg" 
            className="w-full shadow-kiwi-lg"
            onClick={placeOrder}
          >
            {loading ? (
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
              `🍔 Hacer Pedido • ₡${total.toLocaleString()}`
            )}
          </AnimatedButton>
        </div>
      </div>
    </main>
  );
}
