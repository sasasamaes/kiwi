'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOfflineOrders, type CreateOrderData } from './useOfflineOrders';
import { useNetworkStatus } from './useNetworkStatus';
import { OfflineIndicator } from './OfflineIndicator';
import { Package, WifiOff, RefreshCw, DollarSign, Smartphone, CreditCard, Loader } from 'lucide-react';

interface OfflineOrderFormProps {
  merchantId: string;
  merchantName: string;
  onSuccess?: (order: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export function OfflineOrderForm({
  merchantId,
  merchantName,
  onSuccess,
  onError,
  className = '',
}: OfflineOrderFormProps) {
  const { createOrder, unsyncedCount } = useOfflineOrders({ merchantId });
  const { isOnline, isSlowConnection } = useNetworkStatus();
  
  const [step, setStep] = useState<'items' | 'details' | 'payment' | 'confirm'>('items');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Order data
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'sinpe' | 'card' | 'cash' | 'crypto'>('cash');
  const [notes, setNotes] = useState('');
  const [scheduledFor, setScheduledFor] = useState<string>('');

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal >= 5000 ? 0 : 1500;
  const total = subtotal + deliveryFee;

  const addItem = (item: OrderItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.menuItemId === item.menuItemId);
      if (existing) {
        return prev.map(i => 
          i.menuItemId === item.menuItemId 
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateItemQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.menuItemId !== menuItemId));
    } else {
      setItems(prev => prev.map(i => 
        i.menuItemId === menuItemId ? { ...i, quantity } : i
      ));
    }
  };

  const handleSubmit = async () => {
    if (!customerName || !customerPhone || !deliveryAddress || items.length === 0) {
      onError?.('Por favor completa todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData: CreateOrderData = {
        merchantId,
        merchantName,
        customerName,
        customerPhone,
        pickupAddress: pickupAddress || merchantName,
        deliveryAddress,
        items,
        subtotal,
        deliveryFee,
        total,
        paymentMethod,
        notes,
        scheduledFor: scheduledFor ? new Date(scheduledFor).getTime() : undefined,
      };

      const order = await createOrder(orderData);
      
      // Show success message
      const syncMessage = isOnline 
        ? 'Pedido creado y sincronizado'
        : `Pedido guardado localmente (${unsyncedCount + 1} pendientes)`;
      
      onSuccess?.(order);
      
      // Reset form
      setStep('items');
      setCustomerName('');
      setCustomerPhone('');
      setPickupAddress('');
      setDeliveryAddress('');
      setItems([]);
      setPaymentMethod('cash');
      setNotes('');
      setScheduledFor('');
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Error al crear pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`glass rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
            Nuevo Pedido
          </h2>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <motion.div
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 text-xs font-medium"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <WifiOff className="h-3 w-3" />
                <span>Offline</span>
              </motion.div>
            )}
            {unsyncedCount > 0 && (
              <motion.div
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-xs font-medium"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <RefreshCw className="h-3 w-3" />
                <span>{unsyncedCount} pendiente{unsyncedCount !== 1 ? 's' : ''}</span>
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Step Indicator */}
        <div className="flex gap-2 mt-4">
          {(['items', 'details', 'payment', 'confirm'] as const).map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${
                step === s ? 'bg-kiwi-500' : 'bg-surface-200 dark:bg-surface-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {/* Step 1: Items */}
          {step === 'items' && (
            <motion.div
              key="items"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-4">
                Selecciona los productos
              </h3>
              
              {/* Sample menu items - in real app, fetch from API/cache */}
              <div className="space-y-2 mb-4">
                {[
                  { menuItemId: '1', name: 'Bowl Tropikal', price: 4500 },
                  { menuItemId: '2', name: 'Bowl Verde', price: 4200 },
                  { menuItemId: '3', name: 'Café Americano', price: 1200 },
                  { menuItemId: '4', name: 'Smoothie de Frutas', price: 2500 },
                ].map((item) => (
                  <div
                    key={item.menuItemId}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900"
                  >
                    <div>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {item.name}
                      </p>
                      <p className="text-sm text-kiwi-600 dark:text-kiwi-400">
                        ₡{item.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {items.find(i => i.menuItemId === item.menuItemId) && (
                        <>
                          <button
                            onClick={() => {
                              const current = items.find(i => i.menuItemId === item.menuItemId);
                              if (current) updateItemQuantity(item.menuItemId, current.quantity - 1);
                            }}
                            className="w-8 h-8 rounded-full bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-medium">
                            {items.find(i => i.menuItemId === item.menuItemId)?.quantity || 0}
                          </span>
                        </>
                      )}
                      <button
                        onClick={() => addItem(item)}
                        className="w-8 h-8 rounded-full bg-kiwi-500 text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Summary */}
              {items.length > 0 && (
                <div className="p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-600 dark:text-surface-400">
                      {items.reduce((sum, i) => sum + i.quantity, 0)} productos
                    </span>
                    <span className="font-medium text-surface-800 dark:text-surface-200">
                      ₡{subtotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2: Customer Details */}
          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400">
                Datos del cliente
              </h3>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="8888-8888"
                  className="w-full px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Dirección de entrega *
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Dirección completa"
                  className="w-full px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Notas especiales
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones especiales..."
                  rows={2}
                  className="w-full px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Programar para (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200"
                />
              </div>
            </motion.div>
          )}

          {/* Step 3: Payment */}
          {step === 'payment' && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400">
                Método de pago
              </h3>

              <div className="space-y-2">
                {[
                  { id: 'cash', label: 'Efectivo', icon: 'cash', desc: 'Pagar al repartidor' },
                  { id: 'sinpe', label: 'SINPE', icon: 'sinpe', desc: 'Transferencia instantánea' },
                  { id: 'card', label: 'Tarjeta', icon: 'card', desc: 'Credito/Debito' },
                  { id: 'crypto', label: 'Crypto', icon: 'crypto', desc: 'USDC/USDT' },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`w-full p-4 rounded-xl text-left transition-colors ${
                      paymentMethod === method.id
                        ? 'bg-kiwi-50 dark:bg-kiwi-900/30 border-2 border-kiwi-500'
                        : 'bg-surface-50 dark:bg-surface-900 border-2 border-transparent hover:border-surface-200 dark:hover:border-surface-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                      {method.id === 'cash' && <DollarSign className="h-6 w-6" />}
                      {method.id === 'sinpe' && <Smartphone className="h-6 w-6" />}
                      {method.id === 'card' && <CreditCard className="h-6 w-6" />}
                      {method.id === 'crypto' && <DollarSign className="h-6 w-6" />}
                    </span>
                      <div>
                        <p className="font-medium text-surface-800 dark:text-surface-200">
                          {method.label}
                        </p>
                        <p className="text-sm text-surface-500 dark:text-surface-400">
                          {method.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Order Summary */}
              <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900 mt-4">
                <h4 className="font-semibold text-surface-800 dark:text-surface-200 mb-3">
                  Resumen del pedido
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-600 dark:text-surface-400">Subtotal</span>
                    <span className="font-medium">₡{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-600 dark:text-surface-400">Envío</span>
                    <span className="font-medium">
                      {deliveryFee === 0 ? 'Gratis' : `₡${deliveryFee.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
                    <span className="font-semibold text-surface-800 dark:text-surface-200">Total</span>
                    <span className="font-bold text-lg text-kiwi-600 dark:text-kiwi-400">
                      ₡{total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400">
                Confirmar pedido
              </h3>

              {/* Offline Warning */}
              {!isOnline && (
                <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl"><WifiOff className="h-6 w-6" /></span>
                    <div>
                      <p className="font-medium text-orange-700 dark:text-orange-400">
                        Modo Offline
                      </p>
                      <p className="text-sm text-orange-600 dark:text-orange-400">
                        El pedido se guardará localmente y se sincronizará cuando vuelva la conexión.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Details */}
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                  <p className="text-xs text-surface-500 dark:text-surface-400">Cliente</p>
                  <p className="font-medium text-surface-800 dark:text-surface-200">{customerName}</p>
                  <p className="text-sm text-surface-600 dark:text-surface-400">{customerPhone}</p>
                </div>

                <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                  <p className="text-xs text-surface-500 dark:text-surface-400">Entregar en</p>
                  <p className="font-medium text-surface-800 dark:text-surface-200">{deliveryAddress}</p>
                </div>

                <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                  <p className="text-xs text-surface-500 dark:text-surface-400">Productos ({items.length})</p>
                  {items.map((item) => (
                    <div key={item.menuItemId} className="flex justify-between text-sm">
                      <span className="text-surface-600 dark:text-surface-400">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-medium">₡{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                  <p className="text-xs text-surface-500 dark:text-surface-400">Pago</p>
                  <p className="font-medium text-surface-800 dark:text-surface-200 capitalize">
                    {paymentMethod === 'sinpe' ? 'SINPE' : 
                     paymentMethod === 'card' ? 'Tarjeta' :
                     paymentMethod === 'crypto' ? 'Crypto' : 'Efectivo'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800">
                  <div className="flex justify-between">
                    <span className="font-semibold text-surface-800 dark:text-surface-200">Total</span>
                    <span className="font-bold text-xl text-kiwi-600 dark:text-kiwi-400">
                      ₡{total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="p-4 border-t border-surface-100 dark:border-surface-700">
        <div className="flex gap-2">
          {step !== 'items' && (
            <button
              onClick={() => setStep(prev => {
                const steps = ['items', 'details', 'payment', 'confirm'];
                const currentIndex = steps.indexOf(prev);
                return steps[currentIndex - 1] as any;
              })}
              className="flex-1 py-3 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-medium"
            >
              ← Atrás
            </button>
          )}
          
          {step === 'confirm' ? (
            <motion.button
              onClick={handleSubmit}
              disabled={isSubmitting || items.length === 0}
              className={`flex-1 py-3 rounded-xl font-medium ${
                isSubmitting || items.length === 0
                  ? 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                  : 'bg-kiwi-500 hover:bg-kiwi-600 text-white'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader className="h-4 w-4" />
                  </motion.span>
                  Creando...
                </span>
              ) : (
                `Crear Pedido ₡${total.toLocaleString()}`
              )}
            </motion.button>
          ) : (
            <button
              onClick={() => setStep(prev => {
                const steps = ['items', 'details', 'payment', 'confirm'];
                const currentIndex = steps.indexOf(prev);
                return steps[currentIndex + 1] as any;
              })}
              disabled={
                (step === 'items' && items.length === 0) ||
                (step === 'details' && (!customerName || !customerPhone || !deliveryAddress))
              }
              className="flex-1 py-3 rounded-xl bg-kiwi-500 hover:bg-kiwi-600 text-white font-medium disabled:bg-surface-200 dark:disabled:bg-surface-700 disabled:text-surface-500"
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
