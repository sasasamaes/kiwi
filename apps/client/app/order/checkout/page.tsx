// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Coins, Smartphone, CreditCard } from 'lucide-react';
import {
  AnimatedButton,
  TapButton,
  StaggerContainer,
  StaggerItem,
  DeliveryZoneSelect,
  ConsentCheckbox,
  ConsentLink,
  useDeliveryZones,
  api,
  useAuth,
  events,
  safeNavigateToUrl,
  CryptoRateNote,
  SchedulePicker,
  EMPTY_SCHEDULE,
  isValidSchedule,
  scheduleFields,
} from '@kiwi/ui';
import type { ScheduleValue } from '@kiwi/ui';
import { findDeliveryZone } from '@kiwi/types';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  menuItemId?: string;
  selectedOptions?: Array<{ optionId: string }>;
}

type PaymentMethod = 'sinpe' | 'card' | 'cash' | 'crypto_usdc' | 'crypto_usdt';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [merchantId, setMerchantId] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  // ¿El comercio es cocina casera? Habilita preventa programada.
  const [isHomeCook, setIsHomeCook] = useState(false);
  // Tarjeta/SINPE solo si el comercio pasó el KYC de Onvo (flag del admin).
  // Sin eso el backend rechaza el cobro: se muestran inactivos en gris.
  // Default false (fail-closed) hasta cargar el perfil.
  const [cardAllowed, setCardAllowed] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleValue>(EMPTY_SCHEDULE);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  // Métodos habilitados por el admin (/admin/settings)
  const [payAvailability, setPayAvailability] = useState({
    sinpe: true,
    card: true,
    cash: true,
    crypto: true,
  });

  useEffect(() => {
    api
      .getPaymentAvailability()
      .then((a) =>
        setPayAvailability({
          sinpe: a.sinpe !== false,
          card: a.card !== false,
          cash: a.cash !== false,
          crypto: a.crypto !== false,
        }),
      )
      .catch(() => undefined);
  }, []);

  // Cuadro habilitado = flag de plataforma + (SINPE/tarjeta exigen KYC Onvo).
  // Si el método elegido se apaga (o nada está activo), Pedir se desactiva.
  const isPayMethodEnabled = useCallback(
    (id: PaymentMethod): boolean => {
      if (id === 'crypto_usdc' || id === 'crypto_usdt') return payAvailability.crypto;
      if (!(payAvailability as Record<string, boolean>)[id]) return false;
      if ((id === 'sinpe' || id === 'card') && !cardAllowed) return false;
      return true;
    },
    [payAvailability, cardAllowed],
  );

  useEffect(() => {
    setPaymentMethod((prev) => {
      if (isPayMethodEnabled(prev)) return prev;
      const fallback: PaymentMethod[] = ['cash', 'sinpe', 'card', 'crypto_usdc'];
      return fallback.find((f) => isPayMethodEnabled(f)) ?? prev;
    });
  }, [isPayMethodEnabled]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryZone, setDeliveryZone] = useState('');
  const [notes, setNotes] = useState('');
  // Efectivo: con cuánto paga (opcional; debe cubrir el total).
  const [cashTendered, setCashTendered] = useState('');
  // Consentimiento explícito para tratar los datos del pedido (nombre, teléfono
  // y dirección se comparten con comercio y repartidor). Obligatorio para ordenar.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // El pedido puede existir sin cobro iniciado: avisar en vez de prometer link.
  const [payError, setPayError] = useState<string | null>(null);
  // Anti-duplicados (doble tap con wifi caído = N pedidos): bloquea el
  // segundo tap en vuelo y fija una key que se reusa en reintentos para que
  // el backend devuelva el mismo pedido en vez de crear otro.
  const placingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const ensureIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return idempotencyKeyRef.current;
  };

  useEffect(() => {
    // Parse cart from URL params
    const cartParam = searchParams.get('cart');
    const merchantParam = searchParams.get('merchant');
    const merchantNameParam = searchParams.get('merchantName');
    const pickupParam = searchParams.get('pickup');

    if (cartParam) {
      try {
        const parsed = JSON.parse(cartParam);
        // Schema-guard: only well-formed items reach pricing/payment.
        const valid = Array.isArray(parsed)
          ? parsed
              .filter(
                (item: any) =>
                  item &&
                  (typeof item.menuItemId === 'string' || typeof item.id === 'string') &&
                  typeof item.name === 'string' &&
                  Number.isFinite(Number(item.price)) &&
                  Number.isFinite(Number(item.quantity)) &&
                  Number(item.quantity) > 0,
              )
              .map((item: any) => ({
                ...item,
                price: Number(item.price),
                quantity: Number(item.quantity),
              }))
          : [];
        setCart(valid);
      } catch {
        setCart([]);
      }
    }
    if (merchantParam) setMerchantId(merchantParam);
    if (merchantNameParam) setMerchantName(merchantNameParam);
    if (pickupParam) setPickupAddress(decodeURIComponent(pickupParam));
    // Marca de cocina casera del comercio (preventa). Best-effort: si falla,
    // el checkout inmediato sigue funcionando igual que antes.
    if (merchantParam) {
      api
        .getMerchantPublicProfile(merchantParam)
        .then((m) => {
          setIsHomeCook((m as any)?.isHomeCook === true);
          setCardAllowed((m as any)?.cardPaymentsEnabled === true);
        })
        .catch(() => undefined);
    }
  }, [searchParams]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Cargo por servicio Kiwi: % extra sobre productos (standard/cocina casera).
  // El backend cobra el total real; esto es espejo para el desglose.
  const [feeRates, setFeeRates] = useState({ standardPct: 15, homeCookPct: 10 });
  useEffect(() => {
    api
      .getPlatformFees()
      .then((f) => setFeeRates(f))
      .catch(() => undefined);
  }, []);
  const servicePct = (isHomeCook ? feeRates.homeCookPct : feeRates.standardPct) / 100;
  // Kiwi ya no le cobra "servicio" al cliente (lo paga el comercio por factura).
  const serviceFee = 0;
  // Precio del barrio desde la DB (editables en el admin); fallback al catálogo.
  const deliveryZones = useDeliveryZones();
  const zoneTrip =
    deliveryZones.find((z) => z.id === deliveryZone)?.price ??
    findDeliveryZone(deliveryZone)?.price ??
    null;
  // El envío se cobra con +15% de Kiwi; el repartidor recibe el viaje base.
  const tripPct = feeRates.standardPct / 100;
  const deliveryFee = Math.round((zoneTrip ?? 500) * (1 + tripPct));
  const total = subtotal + deliveryFee;
  const phoneDigits = phoneNumber.replace(/\D/g, '');

  const canPlaceOrder =
    customerName.trim().length > 0 &&
    phoneDigits.length >= 8 &&
    address.trim().length > 0 &&
    deliveryZone.trim().length > 0 &&
    cart.length > 0 &&
    isValidSchedule(schedule) &&
    (paymentMethod !== 'cash' || cashTendered === '' || Number(cashTendered) >= total) &&
    isPayMethodEnabled(paymentMethod) &&
    acceptedTerms;

  const placeOrder = useCallback(async () => {
    if (!canPlaceOrder) return;
    if (placingRef.current) return;
    placingRef.current = true;

    setLoading(true);
    setError(null);
    const idempotencyKey = ensureIdempotencyKey();

    try {
      // Create order via NestJS API
      const orderData = {
        merchantId,
        pickupAddress: pickupAddress || 'Nicoya Centro',
        deliveryAddress: address,
        deliveryZone,
        ...scheduleFields(schedule),
        items: cart.map((item) => ({
          menuItemId: item.menuItemId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          variants: (item.selectedOptions ?? []).map((s) => ({ optionId: s.optionId })),
        })),
        specialInstructions: notes,
        distanceKm: 2.5,
        customerPhone: phoneDigits,
        customerName,
        paymentMethod,
        ...(paymentMethod === 'cash' && cashTendered !== ''
          ? { cashTendered: Number(cashTendered) }
          : {}),
      };

      const order =
        api.getToken() && (user as any)?.role === 'customer'
          ? await api.createCustomerOrder(orderData, { idempotencyKey })
          : await api.createGuestOrder(
              {
                ...orderData,
                customerName: customerName.trim(),
                customerPhone: phoneDigits,
              },
              { idempotencyKey },
            );
      setOrderId(order.id);
      events.orders.created(order.id, merchantId, total);

      // Si el cobro no se puede iniciar, el pedido igual existe: se avisa
      // en la pantalla de éxito en vez de prometer un link que no existe.
      let paySetupOk = paymentMethod === 'cash';
      // Process payment based on method
      if (paymentMethod === 'sinpe' || paymentMethod === 'card') {
        try {
          const payPayload = {
            orderId: order.id,
            method: (paymentMethod === 'sinpe' ? 'onvopay_sinpe' : 'onvopay_card') as
              'onvopay_sinpe' | 'onvopay_card',
            amount: total,
            customerPhone: phoneDigits,
          };
          const paymentResult = api.getToken()
            ? await api.createPayment(payPayload)
            : await api.createGuestPayment(payPayload);
          events.payments.initiated(order.id, payPayload.method, total);

          if (paymentResult?.checkoutUrl) {
            // Redirect solo a checkout https allow-listed (validación en el helper)
            if (safeNavigateToUrl(paymentResult.checkoutUrl)) {
              return;
            }
            throw new Error('URL de pago inválida');
          }
        } catch (paymentError) {
          console.warn('Payment processing failed, order created:', paymentError);
          paySetupOk = false;
          events.payments.failed(
            order.id,
            paymentMethod,
            paymentError instanceof Error ? paymentError.message : 'unknown',
          );
          // Order is still created, payment can be completed later
        }
      } else if (paymentMethod === 'crypto_usdc' || paymentMethod === 'crypto_usdt') {
        // Create crypto payment record (server prices from the order total)
        try {
          const cryptoPayload = {
            orderId: order.id,
            method: 'crypto' as const,
            amount: total,
            cryptoCoin: (paymentMethod === 'crypto_usdc' ? 'USDC' : 'USDT') as 'USDC' | 'USDT',
          };
          if (api.getToken()) {
            await api.createPayment(cryptoPayload);
          } else {
            await api.createGuestPayment(cryptoPayload);
          }
          paySetupOk = true;
        } catch (paymentError) {
          console.warn('Crypto payment record failed, order created:', paymentError);
          paySetupOk = false;
        }
      }

      if (!paySetupOk) {
        setPayError(
          'Tu pedido se creó pero no pudimos iniciar el cobro. Te contactaremos para el pago.',
        );
      }
      // For cash (or after payment setup), order is placed successfully
      setOrderPlaced(true);
      // Pedido creado: la key se consume; el próximo pedido necesita una nueva.
      // (Si falló, se conserva para que el reintento no duplique.)
      idempotencyKeyRef.current = null;
    } catch (err: any) {
      console.error('Error placing order:', err);
      setError(err.message || 'No se pudo crear el pedido. Tocá el botón una sola vez.');
    } finally {
      placingRef.current = false;
      setLoading(false);
    }
  }, [
    canPlaceOrder,
    merchantId,
    pickupAddress,
    address,
    deliveryZone,
    cart,
    notes,
    phoneNumber,
    customerName,
    paymentMethod,
    total,
  ]);

  // Order success screen
  if (orderPlaced) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center p-4">
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
            role="img"
            aria-label="Pedido confirmado"
          >
            ✅
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            ¡Pedido creado!
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mb-2">
            Tu pedido #{orderId?.slice(-8).toUpperCase()} fue enviado al comercio.
          </p>
          <p className="text-surface-500 dark:text-surface-400 text-sm mb-8">
            Espera mientras un repartidor acepta tu pedido.
            {paymentMethod === 'cash' && ' Pagas al repartidor al recibir.'}
            {paymentMethod === 'sinpe' &&
              (payError
                ? ' No pudimos enviarte el cobro SINPE todavía.'
                : ' Recibirás un link de pago por SINPE.')}
          </p>
          {payError && (
            <div className="mb-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300">{payError}</p>
            </div>
          )}

          <div className="space-y-3">
            {orderId && (
              <Link href={`/tracking/${orderId}`}>
                <AnimatedButton className="w-full">Rastrear pedido</AnimatedButton>
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
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="pt-safe sticky top-0 z-40 glass-strong"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400"
            >
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </button>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Checkout
            </h1>
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
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">Tu pedido</h2>
          {cart.map((item, index) => (
            <div
              key={item.id || index}
              className="flex justify-between gap-2 py-2 border-b border-surface-100 dark:border-surface-700 last:border-0"
            >
              <span className="min-w-0 flex-1 break-words text-surface-700 dark:text-surface-300">
                {item.quantity}x {item.name}
              </span>
              <span className="shrink-0 font-medium text-surface-800 dark:text-surface-100">
                ₡{(item.price * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Subtotal</span>
              <span className="text-surface-700 dark:text-surface-300">
                ₡{subtotal.toLocaleString()}
              </span>
            </div>
            {serviceFee > 0 && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-surface-500">
                  Servicio Kiwi ({Math.round(servicePct * 100)}%)
                </span>
                <span className="text-surface-700 dark:text-surface-300">
                  ₡{serviceFee.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm mt-1">
              <span className="text-surface-500">Envío</span>
              <span
                className={
                  deliveryFee === 0
                    ? 'text-green-600 font-medium'
                    : 'text-surface-700 dark:text-surface-300'
                }
              >
                {deliveryFee === 0 ? 'Gratis' : `₡${deliveryFee.toLocaleString()}`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-lg mt-2">
              <span className="text-surface-800 dark:text-surface-100">Total</span>
              <span className="text-kiwi-700">₡{total.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>

        {/* Delivery Info */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
            Datos de entrega
          </h2>

          <div className="space-y-3">
            <div>
              <label htmlFor="checkout-name" className="block text-sm text-surface-500 mb-1">
                Tu nombre *
              </label>
              <input
                id="checkout-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre completo"
                autoComplete="name"
                required
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>
            <div>
              <label htmlFor="checkout-phone" className="block text-sm text-surface-500 mb-1">
                Teléfono *
              </label>
              <input
                id="checkout-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="8888-1234"
                autoComplete="tel"
                inputMode="tel"
                required
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>
            <div>
              <label htmlFor="checkout-address" className="block text-sm text-surface-500 mb-1">
                Dirección de entrega *
              </label>
              <input
                id="checkout-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Barrio, calle, referencia..."
                autoComplete="street-address"
                required
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>
            <DeliveryZoneSelect value={deliveryZone} onChange={setDeliveryZone} />
            <div>
              <label className="block text-sm text-surface-500 mb-1">
                Instrucciones (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sin cebolla, portón azul, etc."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600 resize-none"
              />
            </div>
          </div>
        </motion.div>

        {/* Preventa (solo cocinas caseras) */}
        {isHomeCook && (
          <motion.div
            className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h2 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
              📅 ¿Para cuándo?
            </h2>
            <SchedulePicker
              value={schedule}
              onChange={setSchedule}
              hint="Cocina casera: podés pedir hoy aunque esté cerrada, programando su día de venta."
            />
          </motion.div>
        )}

        {/* Payment Method */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
            Método de pago
          </h2>

          {!cardAllowed && (
            <p className="mb-3 rounded-xl bg-surface-100 dark:bg-surface-700/60 px-3 py-2 text-xs text-surface-500 dark:text-surface-400">
              Este comercio cobra en efectivo. La tarjeta se habilita cuando complete su
              verificación.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'cash', label: 'Efectivo', desc: 'Pagar al repartidor' },
                { id: 'sinpe', label: 'SINPE', desc: 'Aprobás en tu banco' },
                { id: 'card', label: 'Tarjeta', desc: 'Tarjeta, Google Pay o Apple Pay' },
                { id: 'crypto_usdc', label: 'USDC', desc: 'Cripto' },
                { id: 'crypto_usdt', label: 'USDT', desc: 'Cripto' },
              ] as const
            ).map((method) => {
              const isCrypto = method.id === 'crypto_usdc' || method.id === 'crypto_usdt';
              const platformOff = isCrypto
                ? !payAvailability.crypto
                : !(payAvailability as Record<string, boolean>)[method.id];
              // Sin KYC de Onvo el comercio no cobra tarjeta/SINPE (el backend lo rechaza).
              const merchantOff = (method.id === 'sinpe' || method.id === 'card') && !cardAllowed;
              const enabled = !platformOff && !merchantOff;
              const offReason = platformOff ? 'No disponible' : merchantOff ? 'No activado' : null;
              const selected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  onClick={() => {
                    if (enabled) setPaymentMethod(method.id);
                  }}
                  disabled={!enabled}
                  aria-disabled={!enabled}
                  title={enabled ? method.label : `${method.label}: ${offReason}`}
                  aria-label={enabled ? method.label : `${method.label} inactivo: ${offReason}`}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selected
                      ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/20'
                      : enabled
                        ? 'border-surface-200 dark:border-surface-700 hover:border-surface-300'
                        : 'border-surface-200 dark:border-surface-700 opacity-50 grayscale cursor-not-allowed'
                  }`}
                >
                  <span className="text-sm font-medium text-surface-800 dark:text-surface-100">
                    {method.label}
                  </span>
                  <span className="block text-xs text-surface-500 mt-0.5">{method.desc}</span>
                  {offReason && (
                    <span className="mt-1 inline-block rounded-full bg-surface-200 dark:bg-surface-600 px-2 py-0.5 text-[10px] font-medium text-surface-500 dark:text-surface-400">
                      🔒 {offReason}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Efectivo: con cuánto paga (para el vuelto) */}
        {paymentMethod === 'cash' && (
          <motion.div
            className="mb-6 rounded-2xl bg-gold-50 dark:bg-gold-900/20 border border-gold-200/60 dark:border-gold-800/40 p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gold-700 dark:text-gold-300">
                ¿Con cuánto pagás? <span className="font-normal">(opcional)</span>
              </span>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500">₡</span>
                <input
                  type="number"
                  min={0}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={`Ej: ${total.toLocaleString()}`}
                  className="w-full rounded-xl border border-gold-200 dark:border-gold-800 bg-white dark:bg-surface-900 pl-8 pr-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                />
              </div>
            </label>
            {cashTendered !== '' && Number(cashTendered) > total && (
              <p className="mt-1.5 text-xs font-semibold text-kiwi-700 dark:text-kiwi-300">
                Vuelto: ₡{(Number(cashTendered) - total).toLocaleString()}
              </p>
            )}
            {cashTendered !== '' && Number(cashTendered) < total && (
              <p className="mt-1.5 text-xs font-semibold text-red-500">
                El monto no cubre el total de ₡{total.toLocaleString()}
              </p>
            )}
          </motion.div>
        )}
        {/* Consentimiento (Ley 8968): sin pre-marcar, obligatorio para ordenar. */}
        <ConsentCheckbox
          checked={acceptedTerms}
          onChange={(checked) => {
            setAcceptedTerms(checked);
            if (checked) setConsentError(false);
          }}
          error={consentError && !acceptedTerms}
          className="mb-4"
        >
          Acepto los <ConsentLink href="/terms">términos</ConsentLink>, la{' '}
          <ConsentLink href="/privacy">política de privacidad</ConsentLink> y la{' '}
          <ConsentLink href="/refunds">política de reembolsos</ConsentLink>. Autorizo a Kiwi a usar
          mi nombre, teléfono y dirección para tomar y entregar este pedido, compartiéndolos con el
          comercio y el repartidor asignado.
        </ConsentCheckbox>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Place Order Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {' '}
          <TapButton
            haptic
            onClick={() => {
              if (!acceptedTerms) {
                setConsentError(true);
                return;
              }
              placeOrder();
            }}
            disabled={!canPlaceOrder || loading}
            className={`w-full h-14 rounded-2xl font-bold text-lg text-white shadow-lg ${
              canPlaceOrder && !loading
                ? 'bg-gradient-to-r from-kiwi-700 to-kiwi-800 hover:from-kiwi-600 hover:to-kiwi-700'
                : 'bg-surface-300 dark:bg-surface-700 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="animate-spin h-5 w-5" /> Procesando...
              </span>
            ) : (
              `Ordenar — ₡${total.toLocaleString()}`
            )}
          </TapButton>
          {!isPayMethodEnabled(paymentMethod) && (
            <p className="text-center text-xs font-medium text-red-500 mt-3">
              Este comercio no tiene métodos de pago activos: no se puede pedir ahora
            </p>
          )}
          <p className="text-center text-xs text-surface-400 mt-3">
            {paymentMethod === 'cash' && (
              <span>
                <Coins className="h-3 w-3 inline" /> Pagas al repartidor al recibir tu pedido
              </span>
            )}{' '}
            {paymentMethod === 'sinpe' && (
              <span>
                <Smartphone className="h-3 w-3 inline" /> Te llevamos al pago seguro: elegí SINPE y
                aprobá en tu banco
              </span>
            )}
            {paymentMethod === 'card' && (
              <span>
                <CreditCard className="h-3 w-3 inline" /> Pago seguro: tarjeta, Google Pay o Apple
                Pay (en iPhone/Mac)
              </span>
            )}
            {paymentMethod === 'crypto_usdc' && (
              <>
                <span>💎 Paga con USDC en la red Stellar</span>
                <CryptoRateNote amountCRC={total} coin="USDC" className="mt-2" />
              </>
            )}
            {paymentMethod === 'crypto_usdt' && (
              <CryptoRateNote amountCRC={total} coin="USDT" className="mt-2" />
            )}
          </p>
          <p className="text-center text-xs text-surface-400 mt-2">
            Al ordenar aceptás nuestros{' '}
            <Link href="/terms" className="text-kiwi-700 hover:underline">
              términos
            </Link>{' '}
            y nuestra{' '}
            <Link href="/privacy" className="text-kiwi-700 hover:underline">
              política de privacidad
            </Link>
            : usamos tu nombre, teléfono y dirección solo para entregar tu pedido.
          </p>
        </motion.div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-surface-500">Cargando…</div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
