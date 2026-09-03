'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton, StaggerContainer, StaggerItem, api } from '@kiwi/ui';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  menuItemId?: string;
}

type PaymentMethod = 'sinpe' | 'card' | 'cash' | 'crypto_usdc' | 'crypto_usdt';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [merchantId, setMerchantId] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Parse cart from URL params
    const cartParam = searchParams.get('cart');
    const merchantParam = searchParams.get('merchant');
    const merchantNameParam = searchParams.get('merchantName');
    const pickupParam = searchParams.get('pickup');
    
    if (cartParam) {
      try {
        setCart(JSON.parse(cartParam));
      } catch { setCart([]); }
    }
    if (merchantParam) setMerchantId(merchantParam);
    if (merchantNameParam) setMerchantName(merchantNameParam);
    if (pickupParam) setPickupAddress(decodeURIComponent(pickupParam));
  }, [searchParams]);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = subtotal >= 5000 ? 0 : 500;
  const total = subtotal + deliveryFee;

  const canPlaceOrder = customerName.trim().length > 0 && 
                         phoneNumber.trim().length >= 8 && 
                         address.trim().length > 0 &&
                         cart.length > 0;

  const placeOrder = useCallback(async () => {
    if (!canPlaceOrder) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Create order via NestJS API
      const orderData = {
        merchantId,
        pickupAddress: pickupAddress || 'Nicoya Centro',
        deliveryAddress: address,
        orderType: 'immediate',
        items: cart.map(item => ({
          menuItemId: item.menuItemId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        specialInstructions: notes,
        distanceKm: 2.5,
        customerPhone: phoneNumber,
        customerName,
        paymentMethod,
      };

      const order = await api.createOrder(orderData);
      setOrderId(order.id);

      // Process payment based on method
      if (paymentMethod === 'sinpe' || paymentMethod === 'card') {
        try {
          const paymentResult = await api.createPayment({
            orderId: order.id,
            method: paymentMethod === 'sinpe' ? 'onvopay_sinpe' : 'onvopay_card',
            amount: total,
            customerPhone: phoneNumber,
            customerEmail: `${phoneNumber}@kiwi.app`,
          });

          if (paymentResult?.checkoutUrl) {
            window.location.href = paymentResult.checkoutUrl;
            return;
          }
        } catch (paymentError) {
          console.warn('Payment processing failed, order created:', paymentError);
          // Order is still created, payment can be completed later
        }
      }

      // For cash or crypto, order is placed successfully
      setOrderPlaced(true);
    } catch (err: any) {
      console.error('Error placing order:', err);
      setError(err.message || 'No se pudo crear el pedido. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [canPlaceOrder, merchantId, pickupAddress, address, cart, notes, phoneNumber, customerName, paymentMethod, total]);

  // Order success screen
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
            🎉
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            ¡Pedido creado!
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mb-2">
            Tu pedido #{orderId?.slice(-8).toUpperCase()} fue enviado al comercio.
          </p>
          <p className="text-surface-400 dark:text-surface-500 text-sm mb-8">
            Espera mientras un repartidor acepta tu pedido. 
            {paymentMethod === 'cash' && ' Pagas al repartidor al recibir.'}
            {paymentMethod === 'sinpe' && ' Recibirás un link de pago por SINPE.'}
          </p>

          <div className="space-y-3">
            {orderId && (
              <Link href={`/tracking/${orderId}`}>
                <AnimatedButton className="w-full">
                  🗺️ Rastrear pedido
                </AnimatedButton>
              </Link>
            )}
            <Link href="/">
              <AnimatedButton variant="secondary" className="w-full">
                Volver al inicio
              </AnimatedButton>
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </button>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">Checkout</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Merchant Info */}
        {merchantName && (
          <motion.div 
            className="mb-6 p-4 rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/20 border border-kiwi-200 dark:border-kiwi-800"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm text-kiwi-700 dark:text-kiwi-300">Pedido de</p>
            <p className="font-semibold text-kiwi-800 dark:text-kiwi-200">{merchantName}</p>
          </motion.div>
        )}

        {/* Cart Summary */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">Tu pedido</h2>
          {cart.map((item, index) => (
            <div key={item.id || index} className="flex justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
              <span className="text-surface-700 dark:text-surface-300">
                {item.quantity}x {item.name}
              </span>
              <span className="font-medium text-surface-800 dark:text-surface-100">
                ₡{(item.price * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Subtotal</span>
              <span className="text-surface-700 dark:text-surface-300">₡{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-surface-500">Envío</span>
              <span className={deliveryFee === 0 ? 'text-green-600 font-medium' : 'text-surface-700 dark:text-surface-300'}>
                {deliveryFee === 0 ? 'Gratis' : `₡${deliveryFee}`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-lg mt-2">
              <span className="text-surface-800 dark:text-surface-100">Total</span>
              <span className="text-kiwi-600">₡{total.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>

        {/* Delivery Info */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">Datos de entrega</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-surface-500 mb-1">Tu nombre *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>
            <div>
              <label className="block text-sm text-surface-500 mb-1">Teléfono *</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="8888-1234"
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>
            <div>
              <label className="block text-sm text-surface-500 mb-1">Dirección de entrega *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Barrio, calle, referencia..."
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>
            <div>
              <label className="block text-sm text-surface-500 mb-1">Instrucciones (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sin cebolla, portón azul, etc."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500 resize-none"
              />
            </div>
          </div>
        </motion.div>

        {/* Payment Method */}
        <motion.div 
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">Método de pago</h2>
          
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'cash', label: '💵 Efectivo', desc: 'Pagar al repartidor' },
              { id: 'sinpe', label: '📱 SINPE', desc: 'Transferencia' },
              { id: 'card', label: '💳 Tarjeta', desc: 'Crédito/Débito' },
              { id: 'crypto_usdc', label: '💎 USDC', desc: 'Cripto' },
            ] as const).map((method) => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  paymentMethod === method.id
                    ? 'border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/20'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                }`}
              >
                <span className="text-sm font-medium text-surface-800 dark:text-surface-100">{method.label}</span>
                <span className="block text-xs text-surface-500 mt-0.5">{method.desc}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Place Order Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <button
            onClick={placeOrder}
            disabled={!canPlaceOrder || loading}
            className={`w-full py-4 rounded-2xl font-bold text-lg text-white transition-all ${
              canPlaceOrder && !loading
                ? 'bg-gradient-to-r from-kiwi-500 to-kiwi-600 hover:from-kiwi-600 hover:to-kiwi-700 shadow-lg'
                : 'bg-surface-300 dark:bg-surface-700 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">🔄</span> Procesando...
              </span>
            ) : (
              `Ordenar — ₡${total.toLocaleString()}`
            )}
          </button>
          <p className="text-center text-xs text-surface-400 mt-3">
            {paymentMethod === 'cash' && '💰 Pagas al repartidor al recibir tu pedido'}
            {paymentMethod === 'sinpe' && '📱 Recibirás un link de pago por SINPE'}
            {paymentMethod === 'card' && '💳 Serás redirigido al pago seguro'}
            {paymentMethod === 'crypto_usdc' && '💎 Paga con USDC en la red Stellar'}
          </p>
        </motion.div>
      </div>
    </main>
  );
}
