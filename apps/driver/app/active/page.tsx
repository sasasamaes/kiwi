'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ActiveOrders() {
  const [orderStatus, setOrderStatus] = useState<'pickup' | 'delivering' | 'delivered'>('pickup');

  return (
    <main className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-surface-600 hover:text-surface-800"
            >
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Pedido Activo</h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {/* Status Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div
              className={`flex items-center gap-2 ${orderStatus === 'pickup' ? 'text-kiwi-600' : 'text-surface-400'}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${orderStatus === 'pickup' ? 'bg-kiwi-500 text-white' : 'bg-surface-200'}`}
              >
                1
              </span>
              <span className="text-sm font-medium">Recoger</span>
            </div>
            <div className="flex-1 mx-2 h-1 bg-surface-200 rounded">
              <div
                className={`h-1 bg-kiwi-500 rounded transition-all ${orderStatus !== 'pickup' ? 'w-full' : 'w-0'}`}
              />
            </div>
            <div
              className={`flex items-center gap-2 ${orderStatus === 'delivering' ? 'text-kiwi-600' : 'text-surface-400'}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${orderStatus === 'delivering' ? 'bg-kiwi-500 text-white' : orderStatus === 'delivered' ? 'bg-kiwi-500 text-white' : 'bg-surface-200'}`}
              >
                2
              </span>
              <span className="text-sm font-medium">Entregar</span>
            </div>
            <div className="flex-1 mx-2 h-1 bg-surface-200 rounded">
              <div
                className={`h-1 bg-kiwi-500 rounded transition-all ${orderStatus === 'delivered' ? 'w-full' : 'w-0'}`}
              />
            </div>
            <div
              className={`flex items-center gap-2 ${orderStatus === 'delivered' ? 'text-kiwi-600' : 'text-surface-400'}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${orderStatus === 'delivered' ? 'bg-kiwi-500 text-white' : 'bg-surface-200'}`}
              >
                3
              </span>
              <span className="text-sm font-medium">Listo</span>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-kiwi-100 px-3 py-1 text-xs font-medium text-kiwi-700">
              Pedido #123
            </span>
            <span className="text-lg font-bold text-surface-800">₡2,500</span>
          </div>

          {/* Pickup Location */}
          <div className="mb-4 rounded-xl bg-kiwi-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">MapPin</span>
              <span className="text-sm font-semibold text-kiwi-700">
                {orderStatus === 'pickup' ? 'Ir a recoger' : 'Recogido'}
              </span>
            </div>
            <p className="text-sm font-medium text-surface-800">Restaurante El Sabor</p>
            <p className="text-xs text-surface-500">Nicoya Centro, 200m</p>
            <button className="mt-3 w-full rounded-xl bg-kiwi-500 py-2.5 text-sm font-medium text-white shadow-kiwi hover:bg-kiwi-600 transition-colors">
              Map Abrir en Maps
            </button>
          </div>

          {/* Delivery Location */}
          <div className="rounded-xl bg-gold-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg">Home</span>
              <span className="text-sm font-semibold text-gold-700">
                {orderStatus === 'delivering'
                  ? 'Ir a entregar'
                  : orderStatus === 'delivered'
                    ? 'Entregado'
                    : 'Entrega'}
              </span>
            </div>
            <p className="text-sm font-medium text-surface-800">Casa del Cliente</p>
            <p className="text-xs text-surface-500">Santa Cruz, 2.5 km</p>
            <button className="mt-3 w-full rounded-xl bg-gold-500 py-2.5 text-sm font-medium text-white shadow-gold hover:bg-gold-600 transition-colors">
              Map Abrir en Maps
            </button>
          </div>

          {/* Customer Info */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-50 p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-kiwi-100 flex items-center justify-center text-kiwi-600 font-semibold">
                MC
              </div>
              <div>
                <p className="text-sm font-medium text-surface-800">María C.</p>
                <p className="text-xs text-surface-400">Star 4.8 • 23 pedidos</p>
              </div>
            </div>
            <button className="rounded-full bg-kiwi-100 p-2 text-kiwi-600 hover:bg-kiwi-200">
              Phone
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {orderStatus === 'pickup' && (
            <button
              onClick={() => setOrderStatus('delivering')}
              className="w-full rounded-2xl bg-kiwi-gradient py-4 text-lg font-semibold text-white shadow-kiwi-lg hover:shadow-kiwi-xl transition-all active:scale-[0.98]"
            >
              Recogi el pedido
            </button>
          )}

          {orderStatus === 'delivering' && (
            <button
              onClick={() => setOrderStatus('delivered')}
              className="w-full rounded-2xl bg-kiwi-gradient py-4 text-lg font-semibold text-white shadow-kiwi-lg hover:shadow-kiwi-xl transition-all active:scale-[0.98]"
            >
              Entregue el pedido
            </button>
          )}

          {orderStatus === 'delivered' && (
            <Link
              href="/"
              className="block w-full rounded-2xl bg-kiwi-gradient py-4 text-center text-lg font-semibold text-white shadow-kiwi-lg hover:shadow-kiwi-xl transition-all active:scale-[0.98]"
            >
              PartyPopper ¡Pedido completado!
            </Link>
          )}

          <button className="w-full rounded-2xl border border-surface-200 bg-white py-3 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors">
            Cancelar pedido
          </button>
        </div>
      </main>
    </main>
  );
}
