'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton, StaggerContainer, StaggerItem, useAuth, useSocket, api } from '@kiwi/ui';

type Step = 1 | 2 | 3 | 4;

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

interface OrderData {
  pickupAddress: string;
  pickupName: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryAddress: string;
  deliveryName: string;
  deliveryPhone: string;
  deliveryLat?: number;
  deliveryLng?: number;
  items: OrderItem[];
  specialInstructions: string;
  isScheduled: boolean;
  scheduledDate: string;
  scheduledTime: string;
  paymentMethod: 'cash' | 'sinpe' | 'card';
}

const savedAddresses = [
  { id: '1', name: 'Mi Negocio', address: 'Nicoya Centro, 200m norte del parque', isDefault: true },
  { id: '2', name: 'Bodega', address: 'Nicoya, 1km sur del estadio' },
];

const quickItems = [
  { name: 'Bowl Tropikal', price: 4500, icon: '🥗' },
  { name: 'Bowl Verde', price: 4200, icon: '🥬' },
  { name: 'Café Americano', price: 1200, icon: '☕' },
  { name: 'Latte', price: 1800, icon: '☕' },
  { name: 'Smoothie Verde', price: 2500, icon: '🥤' },
  { name: 'Patacones', price: 1800, icon: '🍌' },
];

export default function NewOrder() {
  const router = useRouter();
  const { user } = useAuth();
  const { createOrder, isConnected } = useSocket();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const [orderData, setOrderData] = useState<OrderData>({
    pickupAddress: user?.merchantProfile?.address || '',
    pickupName: user?.merchantProfile?.businessName || '',
    deliveryAddress: '',
    deliveryName: '',
    deliveryPhone: '',
    items: [],
    specialInstructions: '',
    isScheduled: false,
    scheduledDate: '',
    scheduledTime: '',
    paymentMethod: 'sinpe',
  });

  const [newItem, setNewItem] = useState({ name: '', quantity: 1, price: 0 });
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const addItem = () => {
    if (newItem.name && newItem.price > 0) {
      const item: OrderItem = {
        id: Math.random().toString(36).substr(2, 9),
        ...newItem,
      };
      setOrderData({
        ...orderData,
        items: [...orderData.items, item],
      });
      setNewItem({ name: '', quantity: 1, price: 0 });
    }
  };

  const addQuickItem = (quickItem: (typeof quickItems)[0]) => {
    const existingItem = orderData.items.find((i) => i.name === quickItem.name);
    if (existingItem) {
      setOrderData({
        ...orderData,
        items: orderData.items.map((i) =>
          i.id === existingItem.id ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      });
    } else {
      const item: OrderItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: quickItem.name,
        quantity: 1,
        price: quickItem.price,
      };
      setOrderData({
        ...orderData,
        items: [...orderData.items, item],
      });
    }
  };

  const updateItemQuantity = (id: string, delta: number) => {
    setOrderData({
      ...orderData,
      items: orderData.items.map((item) => {
        if (item.id === id) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      }),
    });
  };

  const removeItem = (id: string) => {
    setOrderData({
      ...orderData,
      items: orderData.items.filter((item) => item.id !== id),
    });
  };

  const subtotal = orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const commission = Math.round(subtotal * 0.1);
  const deliveryFee = 0; // Free delivery
  const total = subtotal + deliveryFee;

  const createOrderHandler = async () => {
    setLoading(true);
    try {
      const result = await api.createOrder({
        pickupAddress: orderData.pickupAddress,
        pickupLat: orderData.pickupLat,
        pickupLng: orderData.pickupLng,
        deliveryAddress: orderData.deliveryAddress,
        deliveryLat: orderData.deliveryLat,
        deliveryLng: orderData.deliveryLng,
        orderType: orderData.isScheduled ? 'scheduled' : 'immediate',
        scheduledDate: orderData.scheduledDate || undefined,
        scheduledTime: orderData.scheduledTime || undefined,
        specialInstructions: orderData.specialInstructions,
        distanceKm: 2.5, // Mock distance
      });

      setCreatedOrderId(result.id);
      setOrderCreated(true);

      // Emit socket event
      if (isConnected) {
        createOrder({
          orderId: result.id,
          pickupAddress: orderData.pickupAddress,
          deliveryAddress: orderData.deliveryAddress,
          totalAmount: total,
          distanceKm: 2.5,
        });
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Error al crear el pedido. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Recoger', icon: 'MapPin' },
    { num: 2, label: 'Entregar', icon: 'Home' },
    { num: 3, label: 'Detalles', icon: 'Package' },
    { num: 4, label: 'Pagar', icon: 'CreditCard' },
  ];

  // Order Created Success Screen
  if (orderCreated) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center p-4">
        <motion.div
          className="max-w-md w-full text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="text-8xl mb-6"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          >
            PartyPopper
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            ¡Pedido Creado!
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mb-4">
            Tu pedido está buscando repartidor
          </p>

          <div className="rounded-2xl glass p-6 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Número</span>
                <span className="font-semibold text-surface-800 dark:text-surface-200">
                  #{createdOrderId?.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Tipo</span>
                <span className="font-medium text-surface-800 dark:text-surface-200">
                  {orderData.isScheduled ? 'Calendar Programado' : '⚡ Inmediato'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Total</span>
                <span className="font-bold text-kiwi-600 dark:text-kiwi-400">
                  ₡{total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link href="/dashboard">
              <AnimatedButton variant="gradient" className="w-full">
                BarChart3 Volver al Dashboard
              </AnimatedButton>
            </Link>
            <AnimatedButton
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOrderCreated(false);
                setCreatedOrderId(null);
                setOrderData({
                  ...orderData,
                  deliveryAddress: '',
                  deliveryName: '',
                  deliveryPhone: '',
                  items: [],
                  specialInstructions: '',
                });
                setStep(1);
              }}
            >
              ➕ Crear otro pedido
            </AnimatedButton>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">Cancelar</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Nuevo Pedido
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      {/* Progress Steps */}
      <div className="mx-auto w-full max-w-lg px-4 py-4">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <motion.div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all ${
                  step >= s.num
                    ? 'bg-kiwi-500 text-white shadow-kiwi'
                    : 'bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400'
                }`}
                animate={step === s.num ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {step > s.num ? '✓' : s.icon}
              </motion.div>
              <span
                className={`ml-2 text-xs font-medium hidden sm:block ${
                  step >= s.num ? 'text-kiwi-600 dark:text-kiwi-400' : 'text-surface-400'
                }`}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-6 sm:w-8 ${step > s.num ? 'bg-kiwi-500' : 'bg-surface-200 dark:bg-surface-700'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        <AnimatePresence mode="wait">
          {/* Step 1: Pickup Location */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800 dark:text-surface-100">
                MapPin ¿Dónde recoger?
              </h2>

              {/* Saved Addresses */}
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-surface-600 dark:text-surface-400">
                  Direcciones guardadas
                </p>
                <div className="space-y-2">
                  {savedAddresses.map((addr) => (
                    <motion.button
                      key={addr.id}
                      className={`w-full text-left rounded-xl p-4 transition-all ${
                        orderData.pickupAddress === addr.address
                          ? 'border-2 border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30'
                          : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                      }`}
                      onClick={() =>
                        setOrderData({
                          ...orderData,
                          pickupAddress: addr.address,
                          pickupName: addr.name,
                        })
                      }
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-surface-800 dark:text-surface-200">
                            {addr.name}
                          </p>
                          <p className="text-sm text-surface-500 dark:text-surface-400">
                            {addr.address}
                          </p>
                        </div>
                        {addr.isDefault && (
                          <span className="px-2 py-1 rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-xs font-medium text-kiwi-700 dark:text-kiwi-400">
                            Default
                          </span>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Nombre del negocio
                  </label>
                  <input
                    type="text"
                    value={orderData.pickupName}
                    onChange={(e) => setOrderData({ ...orderData, pickupName: e.target.value })}
                    placeholder="Ej: Restaurante El Sabor"
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Dirección completa
                  </label>
                  <textarea
                    value={orderData.pickupAddress}
                    onChange={(e) => setOrderData({ ...orderData, pickupAddress: e.target.value })}
                    placeholder="Ej: Nicoya Centro, 200m norte del parque"
                    rows={3}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                  />
                </div>

                <motion.div
                  className="rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4 cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">MapPin</span>
                    <div>
                      <p className="text-sm font-medium text-kiwi-700 dark:text-kiwi-400">
                        Usar ubicación actual
                      </p>
                      <p className="text-xs text-kiwi-600 dark:text-kiwi-500">
                        Detectar automáticamente
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Delivery Location */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800 dark:text-surface-100">
                Home ¿Dónde entregar?
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Nombre del cliente
                  </label>
                  <input
                    type="text"
                    value={orderData.deliveryName}
                    onChange={(e) => setOrderData({ ...orderData, deliveryName: e.target.value })}
                    placeholder="Ej: María Cordero"
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Teléfono del cliente
                  </label>
                  <input
                    type="tel"
                    value={orderData.deliveryPhone}
                    onChange={(e) => setOrderData({ ...orderData, deliveryPhone: e.target.value })}
                    placeholder="Ej: 8888-1234"
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Dirección de entrega
                  </label>
                  <textarea
                    value={orderData.deliveryAddress}
                    onChange={(e) =>
                      setOrderData({ ...orderData, deliveryAddress: e.target.value })
                    }
                    placeholder="Ej: Santa Cruz, 500m sur del banco"
                    rows={3}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                  />
                </div>

                {/* Distance Estimate */}
                {orderData.deliveryAddress && (
                  <motion.div
                    className="rounded-xl bg-surface-50 dark:bg-surface-800 p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-surface-500 dark:text-surface-400">
                        Distancia estimada
                      </span>
                      <span className="font-medium text-surface-800 dark:text-surface-200">
                        ~2.5 km
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-surface-500 dark:text-surface-400">
                        Tiempo estimado
                      </span>
                      <span className="font-medium text-kiwi-600 dark:text-kiwi-400">~20 min</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Order Details */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800 dark:text-surface-100">
                Package Detalles del pedido
              </h2>

              {/* Quick Add Section */}
              <div className="mb-4">
                <motion.button
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    ⚡ Agregados rápidos
                  </span>
                  <motion.span
                    animate={{ rotate: showQuickAdd ? 180 : 0 }}
                    className="text-surface-400"
                  >
                    ▼
                  </motion.span>
                </motion.button>

                <AnimatePresence>
                  {showQuickAdd && (
                    <motion.div
                      className="mt-2 grid grid-cols-2 gap-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {quickItems.map((item) => (
                        <motion.button
                          key={item.name}
                          className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-kiwi-300 dark:hover:border-kiwi-600 transition-colors"
                          onClick={() => addQuickItem(item)}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span className="text-xl">{item.icon}</span>
                          <div className="text-left">
                            <p className="text-xs font-medium text-surface-700 dark:text-surface-300">
                              {item.name}
                            </p>
                            <p className="text-xs text-kiwi-600 dark:text-kiwi-400">
                              ₡{item.price}
                            </p>
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Custom Item Form */}
              <div className="mb-6 rounded-xl glass p-4">
                <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-400">
                  Agregar producto personalizado
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Nombre del producto"
                    className="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2 text-sm text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20"
                  />
                  <div className="flex gap-3">
                    <div className="flex items-center gap-2">
                      <motion.button
                        className="h-8 w-8 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                        onClick={() =>
                          setNewItem({ ...newItem, quantity: Math.max(1, newItem.quantity - 1) })
                        }
                        whileTap={{ scale: 0.9 }}
                      >
                        −
                      </motion.button>
                      <span className="w-8 text-center font-medium text-surface-800 dark:text-surface-200">
                        {newItem.quantity}
                      </span>
                      <motion.button
                        className="h-8 w-8 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                        onClick={() => setNewItem({ ...newItem, quantity: newItem.quantity + 1 })}
                        whileTap={{ scale: 0.9 }}
                      >
                        +
                      </motion.button>
                    </div>
                    <input
                      type="number"
                      value={newItem.price || ''}
                      onChange={(e) =>
                        setNewItem({ ...newItem, price: parseInt(e.target.value) || 0 })
                      }
                      placeholder="Precio ₡"
                      className="flex-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2 text-sm text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20"
                    />
                    <AnimatedButton variant="primary" size="sm" onClick={addItem}>
                      +
                    </AnimatedButton>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="mb-6 space-y-2">
                <AnimatePresence>
                  {orderData.items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between rounded-xl bg-white dark:bg-surface-800 p-3 shadow-soft dark:shadow-dark"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <motion.button
                            className="h-6 w-6 rounded bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 text-sm"
                            onClick={() => updateItemQuantity(item.id, -1)}
                            whileTap={{ scale: 0.9 }}
                          >
                            −
                          </motion.button>
                          <span className="w-6 text-center text-sm font-medium text-surface-800 dark:text-surface-200">
                            {item.quantity}
                          </span>
                          <motion.button
                            className="h-6 w-6 rounded bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 text-sm"
                            onClick={() => updateItemQuantity(item.id, 1)}
                            whileTap={{ scale: 0.9 }}
                          >
                            +
                          </motion.button>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                            {item.name}
                          </p>
                          <p className="text-xs text-surface-400">
                            ₡{item.price.toLocaleString()} c/u
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-surface-800 dark:text-surface-200">
                          ₡{(item.price * item.quantity).toLocaleString()}
                        </span>
                        <motion.button
                          onClick={() => removeItem(item.id)}
                          className="text-red-400 hover:text-red-600"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          ✕
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {orderData.items.length === 0 && (
                  <div className="rounded-xl bg-surface-50 dark:bg-surface-800 p-8 text-center">
                    <span className="text-4xl">Package</span>
                    <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">
                      Agrega productos al pedido
                    </p>
                  </div>
                )}
              </div>

              {/* Special Instructions */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                  Instrucciones especiales (opcional)
                </label>
                <textarea
                  value={orderData.specialInstructions}
                  onChange={(e) =>
                    setOrderData({ ...orderData, specialInstructions: e.target.value })
                  }
                  placeholder="Ej: Tocar el timbre, dejar en recepción, sin cebolla..."
                  rows={2}
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                />
              </div>

              {/* Schedule Option */}
              <div className="rounded-xl glass p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-200">
                      Calendar Programar para después
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Elige fecha y hora específica
                    </p>
                  </div>
                  <motion.button
                    onClick={() =>
                      setOrderData({ ...orderData, isScheduled: !orderData.isScheduled })
                    }
                    className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                      orderData.isScheduled ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      className="h-6 w-6 rounded-full bg-white shadow-md"
                      animate={{ x: orderData.isScheduled ? 24 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </motion.button>
                </div>

                <AnimatePresence>
                  {orderData.isScheduled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 flex gap-3">
                        <input
                          type="date"
                          value={orderData.scheduledDate}
                          onChange={(e) =>
                            setOrderData({ ...orderData, scheduledDate: e.target.value })
                          }
                          className="flex-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2 text-sm text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20"
                        />
                        <input
                          type="time"
                          value={orderData.scheduledTime}
                          onChange={(e) =>
                            setOrderData({ ...orderData, scheduledTime: e.target.value })
                          }
                          className="flex-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2 text-sm text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Step 4: Payment & Review */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800 dark:text-surface-100">
                CreditCard Resumen y pago
              </h2>

              {/* Order Summary */}
              <div className="mb-6 rounded-xl glass p-4">
                <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-400">
                  Resumen del pedido
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">MapPin Recoger:</span>
                    <span className="font-medium text-surface-800 dark:text-surface-200 text-right max-w-[60%]">
                      {orderData.pickupName || 'No especificado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">Home Entregar:</span>
                    <span className="font-medium text-surface-800 dark:text-surface-200 text-right max-w-[60%]">
                      {orderData.deliveryName || 'No especificado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">Package Productos:</span>
                    <span className="font-medium text-surface-800 dark:text-surface-200">
                      {orderData.items.length} items (
                      {orderData.items.reduce((sum, i) => sum + i.quantity, 0)} uds)
                    </span>
                  </div>
                  {orderData.isScheduled && (
                    <div className="flex justify-between">
                      <span className="text-surface-500 dark:text-surface-400">Calendar Programado:</span>
                      <span className="font-medium text-kiwi-600 dark:text-kiwi-400">
                        {orderData.scheduledDate} {orderData.scheduledTime}
                      </span>
                    </div>
                  )}
                </div>

                {/* Items Breakdown */}
                <div className="mt-4 border-t border-surface-100 dark:border-surface-700 pt-4">
                  <div className="space-y-2">
                    {orderData.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-surface-600 dark:text-surface-400">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-surface-800 dark:text-surface-200">
                          ₡{(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-surface-100 dark:border-surface-700 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">Subtotal</span>
                    <span className="text-surface-800 dark:text-surface-200">
                      ₡{subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">Envío</span>
                    <span className="text-kiwi-600 dark:text-kiwi-400 font-medium">Gratis PartyPopper</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">
                      Comisión Kiwi (10%)
                    </span>
                    <span className="text-surface-600 dark:text-surface-400">
                      ₡{commission.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg mt-2 pt-2 border-t border-surface-100 dark:border-surface-700">
                    <span className="font-semibold text-surface-800 dark:text-surface-200">
                      Total
                    </span>
                    <span className="font-bold text-kiwi-600 dark:text-kiwi-400">
                      ₡{total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-6 rounded-xl glass p-4">
                <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-400">
                  Método de pago
                </h3>
                <div className="space-y-2">
                  {[
                    {
                      id: 'sinpe',
                      icon: 'Smartphone',
                      label: 'SINPE Móvil',
                      desc: 'Transferencia instantánea',
                    },
                    { id: 'card', icon: 'CreditCard', label: 'Tarjeta', desc: 'Crédito o débito' },
                    { id: 'cash', icon: 'DollarSign', label: 'Efectivo', desc: 'Pagar al repartidor' },
                  ].map((method) => (
                    <motion.button
                      key={method.id}
                      onClick={() =>
                        setOrderData({ ...orderData, paymentMethod: method.id as any })
                      }
                      className={`w-full flex items-center justify-between rounded-xl p-4 transition-all ${
                        orderData.paymentMethod === method.id
                          ? 'border-2 border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30'
                          : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 hover:border-surface-300 dark:hover:border-surface-600'
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{method.icon}</span>
                        <div className="text-left">
                          <p className="font-medium text-surface-800 dark:text-surface-200">
                            {method.label}
                          </p>
                          <p className="text-xs text-surface-500 dark:text-surface-400">
                            {method.desc}
                          </p>
                        </div>
                      </div>
                      {orderData.paymentMethod === method.id && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-kiwi-500 text-xl"
                        >
                          ✓
                        </motion.span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Actions */}
      <div className="sticky bottom-0 border-t border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl p-4">
        <div className="mx-auto max-w-lg flex gap-3">
          {step > 1 && (
            <AnimatedButton
              variant="secondary"
              onClick={() => setStep((step - 1) as Step)}
              className="flex-1 dark:bg-surface-800 dark:text-surface-300"
            >
              ← Atrás
            </AnimatedButton>
          )}

          {step < 4 ? (
            <AnimatedButton
              variant="gradient"
              onClick={() => setStep((step + 1) as Step)}
              className="flex-1"
              disabled={
                (step === 1 && !orderData.pickupAddress) ||
                (step === 2 && !orderData.deliveryAddress) ||
                (step === 3 && orderData.items.length === 0)
              }
            >
              Siguiente →
            </AnimatedButton>
          ) : (
            <AnimatedButton
              variant="gradient"
              size="lg"
              className="flex-1 shadow-kiwi-lg"
              onClick={createOrderHandler}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    Clock
                  </motion.span>
                  Creando...
                </span>
              ) : (
                `🚀 Crear Pedido • ₡${total.toLocaleString()}`
              )}
            </AnimatedButton>
          )}
        </div>
      </div>
    </main>
  );
}
