'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton, StaggerContainer, StaggerItem, slideInRight, slideInLeft } from '@kiwi/ui';

type Step = 1 | 2 | 3 | 4;

interface OrderData {
  pickupAddress: string;
  pickupName: string;
  deliveryAddress: string;
  deliveryName: string;
  deliveryPhone: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  specialInstructions: string;
  isScheduled: boolean;
  scheduledDate: string;
  scheduledTime: string;
  paymentMethod: 'cash' | 'sinpe' | 'card';
}

export default function NewOrder() {
  const [step, setStep] = useState<Step>(1);
  const [orderData, setOrderData] = useState<OrderData>({
    pickupAddress: '',
    pickupName: '',
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

  const addItem = () => {
    if (newItem.name && newItem.price > 0) {
      setOrderData({
        ...orderData,
        items: [...orderData.items, newItem],
      });
      setNewItem({ name: '', quantity: 1, price: 0 });
    }
  };

  const removeItem = (index: number) => {
    setOrderData({
      ...orderData,
      items: orderData.items.filter((_, i) => i !== index),
    });
  };

  const total = orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const steps = [
    { num: 1, label: 'Recoger' },
    { num: 2, label: 'Entregar' },
    { num: 3, label: 'Detalles' },
    { num: 4, label: 'Pagar' },
  ];

  return (
    <main className="min-h-screen flex flex-col bg-bg-light">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 text-surface-600 hover:text-surface-800">
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">Cancelar</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Nuevo Pedido</h1>
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
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step >= s.num
                    ? 'bg-kiwi-500 text-white'
                    : 'bg-surface-200 text-surface-500'
                }`}
                animate={step === s.num ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {step > s.num ? '✓' : s.num}
              </motion.div>
              <span className={`ml-2 text-xs font-medium ${step >= s.num ? 'text-kiwi-600' : 'text-surface-400'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={`mx-2 h-0.5 w-8 ${step > s.num ? 'bg-kiwi-500' : 'bg-surface-200'}`} />
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
              variants={slideInRight}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800">
                📍 ¿Dónde recoger?
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600">
                    Nombre del negocio
                  </label>
                  <input
                    type="text"
                    value={orderData.pickupName}
                    onChange={(e) => setOrderData({ ...orderData, pickupName: e.target.value })}
                    placeholder="Ej: Restaurante El Sabor"
                    className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-surface-800 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600">
                    Dirección completa
                  </label>
                  <textarea
                    value={orderData.pickupAddress}
                    onChange={(e) => setOrderData({ ...orderData, pickupAddress: e.target.value })}
                    placeholder="Ej: Nicoya Centro, 200m norte del parque"
                    rows={3}
                    className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-surface-800 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                  />
                </div>

                <motion.div 
                  className="rounded-xl bg-kiwi-50 p-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📍</span>
                    <div>
                      <p className="text-sm font-medium text-kiwi-700">Usar ubicación actual</p>
                      <p className="text-xs text-kiwi-600">Detectar automáticamente</p>
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
              variants={slideInRight}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800">
                🏠 ¿Dónde entregar?
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600">
                    Nombre del cliente
                  </label>
                  <input
                    type="text"
                    value={orderData.deliveryName}
                    onChange={(e) => setOrderData({ ...orderData, deliveryName: e.target.value })}
                    placeholder="Ej: María Cordero"
                    className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-surface-800 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600">
                    Teléfono del cliente
                  </label>
                  <input
                    type="tel"
                    value={orderData.deliveryPhone}
                    onChange={(e) => setOrderData({ ...orderData, deliveryPhone: e.target.value })}
                    placeholder="Ej: 8888-1234"
                    className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-surface-800 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600">
                    Dirección de entrega
                  </label>
                  <textarea
                    value={orderData.deliveryAddress}
                    onChange={(e) => setOrderData({ ...orderData, deliveryAddress: e.target.value })}
                    placeholder="Ej: Santa Cruz, 500m sur del banco"
                    rows={3}
                    className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-surface-800 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Order Details */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={slideInRight}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800">
                📦 Detalles del pedido
              </h2>
              
              {/* Add Item Form */}
              <div className="mb-6 rounded-xl bg-white p-4 shadow-soft">
                <h3 className="mb-3 text-sm font-semibold text-surface-600">Agregar producto</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Nombre del producto"
                    className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20"
                  />
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-20 rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20"
                    />
                    <input
                      type="number"
                      value={newItem.price || ''}
                      onChange={(e) => setNewItem({ ...newItem, price: parseInt(e.target.value) || 0 })}
                      placeholder="Precio ₡"
                      className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20"
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
                  {orderData.items.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between rounded-xl bg-white p-3 shadow-soft"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kiwi-100 text-sm font-medium text-kiwi-700">
                          {item.quantity}x
                        </span>
                        <div>
                          <p className="text-sm font-medium text-surface-800">{item.name}</p>
                          <p className="text-xs text-surface-400">₡{item.price} c/u</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-surface-700">₡{item.price * item.quantity}</span>
                        <motion.button
                          onClick={() => removeItem(index)}
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
                  <div className="rounded-xl bg-surface-50 p-8 text-center">
                    <span className="text-4xl">📦</span>
                    <p className="mt-2 text-sm text-surface-500">Agrega productos al pedido</p>
                  </div>
                )}
              </div>

              {/* Special Instructions */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-surface-600">
                  Instrucciones especiales (opcional)
                </label>
                <textarea
                  value={orderData.specialInstructions}
                  onChange={(e) => setOrderData({ ...orderData, specialInstructions: e.target.value })}
                  placeholder="Ej: Tocar el timbre, dejar en recepción..."
                  rows={2}
                  className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-surface-800 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                />
              </div>

              {/* Schedule Option */}
              <div className="rounded-xl bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-surface-800">Programar para después</p>
                    <p className="text-xs text-surface-500">Elige fecha y hora</p>
                  </div>
                  <motion.button
                    onClick={() => setOrderData({ ...orderData, isScheduled: !orderData.isScheduled })}
                    className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                      orderData.isScheduled ? 'bg-kiwi-500' : 'bg-surface-300'
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
                          onChange={(e) => setOrderData({ ...orderData, scheduledDate: e.target.value })}
                          className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20"
                        />
                        <input
                          type="time"
                          value={orderData.scheduledTime}
                          onChange={(e) => setOrderData({ ...orderData, scheduledTime: e.target.value })}
                          className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && (
            <motion.div
              key="step4"
              variants={slideInRight}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800">
                💳 Resumen y pago
              </h2>
              
              {/* Order Summary */}
              <div className="mb-6 rounded-xl bg-white p-4 shadow-soft">
                <h3 className="mb-3 text-sm font-semibold text-surface-600">Resumen del pedido</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-500">📍 Recoger:</span>
                    <span className="font-medium text-surface-800">{orderData.pickupName || 'No especificado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">🏠 Entregar:</span>
                    <span className="font-medium text-surface-800">{orderData.deliveryName || 'No especificado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">📦 Productos:</span>
                    <span className="font-medium text-surface-800">{orderData.items.length} items</span>
                  </div>
                  {orderData.isScheduled && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">📅 Programado:</span>
                      <span className="font-medium text-kiwi-600">{orderData.scheduledDate} {orderData.scheduledTime}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-surface-100 pt-4">
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold text-surface-800">Total:</span>
                    <span className="font-bold text-kiwi-600">₡{total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-surface-500">
                    <span>Comisión Kiwi (10%):</span>
                    <span>₡{(total * 0.1).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-6 rounded-xl bg-white p-4 shadow-soft">
                <h3 className="mb-3 text-sm font-semibold text-surface-600">Método de pago</h3>
                <div className="space-y-2">
                  {[
                    { id: 'sinpe', label: '📱 SINPE Móvil', desc: 'Transferencia instantánea' },
                    { id: 'card', label: '💳 Tarjeta', desc: 'Crédito o débito' },
                    { id: 'cash', label: '💵 Efectivo', desc: 'Pagar al repartidor' },
                  ].map((method) => (
                    <motion.button
                      key={method.id}
                      onClick={() => setOrderData({ ...orderData, paymentMethod: method.id as any })}
                      className={`w-full flex items-center justify-between rounded-xl p-3 transition-all ${
                        orderData.paymentMethod === method.id
                          ? 'border-2 border-kiwi-500 bg-kiwi-50'
                          : 'border border-surface-200 bg-white hover:border-surface-300'
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{method.label.split(' ')[0]}</span>
                        <div className="text-left">
                          <p className="text-sm font-medium text-surface-800">{method.label.slice(3)}</p>
                          <p className="text-xs text-surface-500">{method.desc}</p>
                        </div>
                      </div>
                      {orderData.paymentMethod === method.id && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-kiwi-500"
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
      <div className="sticky bottom-0 border-t border-surface-200/50 bg-white/80 backdrop-blur-xl p-4">
        <div className="mx-auto max-w-lg flex gap-3">
          {step > 1 && (
            <AnimatedButton
              variant="secondary"
              onClick={() => setStep((step - 1) as Step)}
              className="flex-1"
            >
              ← Atrás
            </AnimatedButton>
          )}
          
          {step < 4 ? (
            <AnimatedButton
              variant="gradient"
              onClick={() => setStep((step + 1) as Step)}
              className="flex-1"
            >
              Siguiente →
            </AnimatedButton>
          ) : (
            <AnimatedButton
              variant="gradient"
              size="lg"
              className="flex-1 shadow-kiwi-lg"
            >
              🚀 Crear Pedido
            </AnimatedButton>
          )}
        </div>
      </div>
    </main>
  );
}
