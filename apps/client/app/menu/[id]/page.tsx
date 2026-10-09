// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Utensils,
  Star,
  MapPin,
  Clock,
  Smartphone,
  CreditCard,
  DollarSign,
  PartyPopper,
  Home,
  RefreshCw,
  ShoppingCart,
  Package,
  User,
  FileText,
  X,
} from 'lucide-react';
import {
  AnimatedButton,
  ScrollReveal,
  TapButton,
  Skeleton,
  api,
  events,
  MenuItem,
  MerchantPublicProfile,
  useSocket,
  AddressInput,
  DeliveryZoneSelect,
  OnvoPayCheckout,
  CryptoCheckout,
  CryptoRateNote,
  safeNavigateToUrl,
  useAuth,
  isEmojiImage,
  isHttpUrl,
  hoverCard,
  hoverChip,
  hoverGhost,
  ThemeToggle,
} from '@kiwi/ui';
import { findDeliveryZone } from '@kiwi/types';

interface CartItem extends MenuItem {
  quantity: number;
  /** Identidad de línea: producto + combinación elegida. */
  lineId: string;
  /** Precio unitario con deltas aplicados. */
  unitPrice: number;
  selectedOptions: SelectedOption[];
}

const lineIdFor = (menuItemId: string, picks: SelectedOption[]) =>
  `${menuItemId}::${[...picks]
    .map((p) => p.optionId)
    .sort()
    .join(',')}`;

/** Rating Decimal→string-safe (ver rate/page: el rating viaja como Decimal→string). */
const formatRating = (v: unknown): string => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number).toFixed(1) : '5.0';
};

const unitPriceFor = (base: number, picks: SelectedOption[]) =>
  Math.round((base + picks.reduce((s, p) => s + p.priceDelta, 0)) * 100) / 100;

/** Email invitado sanitizado (solo dígitos: "8888 1234" rompía OnvoPay). */
interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

interface CartLine {
  lineId: string;
  menuItemId: string;
  name: string;
  image: string;
  quantity: number;
  unitPrice: number;
  selectedOptions: SelectedOption[];
}

interface DeliveryInfo {
  address: string;
  phone: string;
  name: string;
  instructions: string;
  zone: string;
}

export default function MenuPage() {
  const params = useParams();
  const router = useRouter();
  const merchantId = params.id as string;

  const [merchant, setMerchant] = useState<MerchantPublicProfile | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todos']);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  /** Clave que reinicia la animación de rebote del carrito (TapButton onSuccess). */
  const [cartBounceKey, setCartBounceKey] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  // Producto en el picker de variantes (null = picker cerrado).
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [pickError, setPickError] = useState<string | null>(null);

  // Delivery info
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    address: '',
    phone: '',
    name: '',
    instructions: '',
    zone: '',
  });

  // Payment method
  type PaymentMethod = 'sinpe' | 'card' | 'cash' | 'crypto_usdc' | 'crypto_usdt';
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sinpe');
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
      .then((a) => {
        const next = {
          sinpe: a.sinpe !== false,
          card: a.card !== false,
          cash: a.cash !== false,
          crypto: a.crypto !== false,
        };
        setPayAvailability(next);
        setPaymentMethod((prev) => {
          const avail = next as Record<string, boolean>;
          const key = prev.startsWith('crypto_') ? 'crypto' : prev;
          if (avail[key]) return prev;
          const fallback: PaymentMethod[] = ['sinpe', 'card', 'cash'];
          return fallback.find((f) => avail[f]) ?? prev;
        });
      })
      .catch(() => undefined);
  }, []);

  // Payment state
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<any>(null);
  // Pedido ya creado con pago pendiente (modal descartado): reintentar el
  // pago SIN crear otro pedido.
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  // Espejo ref: los callbacks de pago se memoizan y verían el valor viejo.
  const pendingOrderIdRef = useRef<string | null>(null);
  useEffect(() => {
    pendingOrderIdRef.current = pendingOrderId;
  }, [pendingOrderId]);
  // Total congelado para el recibo (el carrito se vacía al pagar).
  const [placedTotal, setPlacedTotal] = useState(0);

  // Socket for real-time order updates
  const { isConnected } = useSocket();
  const { user } = useAuth();
  const userRole = (user as any)?.role as string | undefined;

  // Fetch merchant profile and menu items
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [merchantData, menuData] = await Promise.all([
        api.getMerchantPublicProfile(merchantId),
        api.getMerchantMenuItems(merchantId),
      ]);

      setMerchant(merchantData);
      setMenuItems(menuData.items);
      setCategories(menuData.categories);
      events.menu.viewed(merchantId);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el menú');
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Otro comercio (navegación cliente entre menús): carrito, zona y pedido
  // pendiente son del anterior — resetear para no cobrarle a quien no es.
  useEffect(() => {
    setCart([]);
    setDeliveryInfo({ address: '', phone: '', name: '', instructions: '', zone: '' });
    setPendingOrderId(null);
    checkoutKeyRef.current = null;
    setOrderSuccess(null);
    setShowCheckout(false);
    setPaymentPending(false);
    setPaymentIntent(null);
  }, [merchantId]);

  // Cart functions
  const addLine = useCallback((item: MenuItem, selected: SelectedOption[]) => {
    const lineId = lineIdFor(item.id, selected);
    const unitPrice = unitPriceFor(Number(item.price), selected);
    events.menu.itemAdded(item.id, item.name, unitPrice);
    setCart((prev) => {
      const existing = prev.find((c) => c.lineId === lineId);
      if (existing) {
        return prev.map((c) => (c.lineId === lineId ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { ...item, lineId, unitPrice, selectedOptions: selected, quantity: 1 }];
    });
  }, []);

  const addToCart = useCallback(
    (item: MenuItem) => {
      const groups = item.variantGroups ?? [];
      const hasOptions = groups.some((g) => g.options.length > 0);
      if (hasOptions) {
        // Defaults: primera opción DISPONIBLE de cada grupo obligatorio simple.
        const initial: Record<string, string[]> = {};
        for (const g of groups) {
          const firstAvailable = g.options.find((o) => o.isAvailable !== false);
          if (g.required && !g.multiple && firstAvailable) {
            initial[g.id] = [firstAvailable.id];
          }
        }
        setPicks(initial);
        setPickError(null);
        setPicking(item);
        return;
      }
      addLine(item, []);
    },
    [addLine],
  );

  const togglePick = useCallback((groupId: string, optionId: string, multiple: boolean) => {
    setPicks((prev) => {
      const current = prev[groupId] ?? [];
      if (multiple) {
        return {
          ...prev,
          [groupId]: current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId],
        };
      }
      return { ...prev, [groupId]: [optionId] };
    });
  }, []);

  const confirmPick = useCallback(() => {
    if (!picking) return;
    const groups = picking.variantGroups ?? [];
    const missing = groups.find((g) => g.required && (picks[g.id] ?? []).length === 0);
    if (missing) {
      const noneAvailable = missing.options.every((o) => o.isAvailable === false);
      setPickError(
        noneAvailable
          ? `Agotado: no queda ninguna opción de "${missing.name}"`
          : `Elegí una opción de "${missing.name}"`,
      );
      return;
    }
    const selected: SelectedOption[] = [];
    for (const g of groups) {
      for (const optionId of picks[g.id] ?? []) {
        const opt = g.options.find((o) => o.id === optionId);
        if (opt) {
          selected.push({
            groupId: g.id,
            groupName: g.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: Number(opt.priceDelta),
          });
        }
      }
    }
    addLine(picking, selected);
    setPicking(null);
    setPicks({});
  }, [picking, picks, addLine]);

  const removeFromCart = useCallback((lineId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.lineId === lineId);
      if (existing && existing.quantity > 1) {
        return prev.map((c) => (c.lineId === lineId ? { ...c, quantity: c.quantity - 1 } : c));
      }
      return prev.filter((c) => c.lineId !== lineId);
    });
  }, []);

  /** − del card: descuenta la línea más reciente de ese producto. */
  const decrementMenuItem = useCallback((menuItemId: string) => {
    setCart((prev) => {
      const lines = prev.filter((c) => c.id === menuItemId);
      if (lines.length === 0) return prev;
      const target = lines[lines.length - 1];
      if (target.quantity > 1) {
        return prev.map((c) =>
          c.lineId === target.lineId ? { ...c, quantity: c.quantity - 1 } : c,
        );
      }
      return prev.filter((c) => c.lineId !== target.lineId);
    });
  }, []);

  const getItemQuantity = useCallback(
    (itemId: string) => {
      return cart.filter((c) => c.id === itemId).reduce((s, c) => s + c.quantity, 0);
    },
    [cart],
  );

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  // Sin comisión al cliente: paga productos + envío. El envío es SIEMPRE el
  // precio del barrio (sin "gratis +₡5000": el servidor no tiene esa regla).
  const zoneTrip = findDeliveryZone(deliveryInfo.zone)?.price ?? null;
  const deliveryFee = zoneTrip ?? 500;
  const totalWithDelivery = cartTotal + deliveryFee;

  /** Solo dígitos para validar y para el email invitado. */
  const phoneDigits = deliveryInfo.phone.replace(/\D/g, '');

  // Filter items by category
  const filteredItems =
    selectedCategory === 'Todos'
      ? menuItems
      : menuItems.filter((item) => item.category === selectedCategory);

  // Validate checkout
  const canCheckout =
    deliveryInfo.address.trim().length > 0 &&
    deliveryInfo.zone.trim().length > 0 &&
    phoneDigits.length >= 8 &&
    deliveryInfo.name.trim().length > 0 &&
    merchant?.isOpen !== false;

  // Anti-duplicados (doble tap con wifi caído = N pedidos): el state
  // llega tarde al segundo tap; el ref no. La key se reusa en reintentos
  // para que el backend devuelva el mismo pedido.
  const checkingOutRef = useRef(false);
  const checkoutKeyRef = useRef<string | null>(null);
  // Checkout handler
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0 || !merchant || !canCheckout) return;
    if (merchant.isOpen === false) return;

    // Pago pendiente de un pedido ya creado: reintentar SOLO el pago.
    if (pendingOrderId) {
      await retryPendingPayment();
      return;
    }
    if (checkingOutRef.current) return;
    checkingOutRef.current = true;
    if (!checkoutKeyRef.current) {
      checkoutKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    setCheckingOut(true);
    try {
      const orderData = {
        merchantId: merchant.id,
        pickupAddress: merchant.address,
        deliveryAddress: deliveryInfo.address,
        deliveryZone: deliveryInfo.zone,
        orderType: 'immediate',
        items: cart.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          price: item.unitPrice,
          quantity: item.quantity,
          variants: item.selectedOptions.map((s) => ({ optionId: s.optionId })),
        })),
        specialInstructions: deliveryInfo.instructions,
        distanceKm: 2.5,
        customerPhone: phoneDigits,
        customerName: deliveryInfo.name,
        paymentMethod,
      };

      const order =
        api.getToken() && userRole === 'customer'
          ? await api.createCustomerOrder(orderData, { idempotencyKey: checkoutKeyRef.current! })
          : api.getToken() && userRole === 'merchant'
            ? await api.createOrder(orderData, { idempotencyKey: checkoutKeyRef.current! })
            : await api.createGuestOrder(orderData, { idempotencyKey: checkoutKeyRef.current! });
      setPendingOrderId(order.id);

      // Handle payment based on method
      if (paymentMethod === 'sinpe' || paymentMethod === 'card') {
        // Create payment with OnvoPay
        const payPayload = {
          orderId: order.id,
          method: (paymentMethod === 'sinpe' ? 'onvopay_sinpe' : 'onvopay_card') as
            'onvopay_sinpe' | 'onvopay_card',
          amount: totalWithDelivery,
          customerPhone: phoneDigits,
        };
        const paymentResult = api.getToken()
          ? await api.createPayment(payPayload)
          : await api.createGuestPayment(payPayload);

        if (
          paymentResult.checkoutUrl &&
          safeNavigateToUrl(paymentResult.checkoutUrl) // https allow-listed host only
        ) {
          return;
        }

        setPaymentIntent(paymentResult);
        setPaymentPending(true);
      } else if (paymentMethod === 'crypto_usdc' || paymentMethod === 'crypto_usdt') {
        // Create crypto payment
        const coin = paymentMethod === 'crypto_usdc' ? 'USDC' : 'USDT';
        const cryptoPayload = {
          orderId: order.id,
          method: 'crypto' as const,
          amount: totalWithDelivery,
          cryptoCoin: coin as 'USDC' | 'USDT',
        };
        const paymentResult = api.getToken()
          ? await api.createPayment(cryptoPayload)
          : await api.createGuestPayment(cryptoPayload);

        setPaymentIntent(paymentResult);
        setPaymentPending(true);
      } else {
        // Cash payment - no external processing needed
        setPlacedTotal(totalWithDelivery);
        setCart([]);
        setShowCheckout(false);
        setPendingOrderId(null);
        checkoutKeyRef.current = null;
        setOrderSuccess(order.id);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error
          ? err.message
          : 'Error al crear el pedido. Tocá el botón una sola vez.',
      );
    } finally {
      checkingOutRef.current = false;
      setCheckingOut(false);
    }
  }, [
    cart,
    merchant,
    deliveryInfo,
    canCheckout,
    paymentMethod,
    totalWithDelivery,
    phoneDigits,
    pendingOrderId,
  ]);

  // Reintenta SOLO el pago de un pedido ya creado (el modal se descartó).
  const retryPendingPayment = useCallback(async () => {
    if (!pendingOrderId) return;
    setCheckingOut(true);
    try {
      if (paymentMethod === 'sinpe' || paymentMethod === 'card') {
        const retryPayload = {
          orderId: pendingOrderId,
          method: (paymentMethod === 'sinpe' ? 'onvopay_sinpe' : 'onvopay_card') as
            'onvopay_sinpe' | 'onvopay_card',
          amount: totalWithDelivery,
          customerPhone: phoneDigits,
        };
        const paymentResult = api.getToken()
          ? await api.createPayment(retryPayload)
          : await api.createGuestPayment(retryPayload);
        if (paymentResult.checkoutUrl && safeNavigateToUrl(paymentResult.checkoutUrl)) return;
        setPaymentIntent(paymentResult);
        setPaymentPending(true);
      } else if (paymentMethod === 'crypto_usdc' || paymentMethod === 'crypto_usdt') {
        const coin = paymentMethod === 'crypto_usdc' ? 'USDC' : 'USDT';
        const retryCrypto = {
          orderId: pendingOrderId,
          method: 'crypto' as const,
          amount: totalWithDelivery,
          cryptoCoin: coin as 'USDC' | 'USDT',
        };
        const paymentResult = api.getToken()
          ? await api.createPayment(retryCrypto)
          : await api.createGuestPayment(retryCrypto);
        setPaymentIntent(paymentResult);
        setPaymentPending(true);
      } else {
        setPlacedTotal(totalWithDelivery);
        setCart([]);
        setShowCheckout(false);
        setPendingOrderId(null);
        setOrderSuccess(pendingOrderId);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'No se pudo reintentar el pago. Intentá de nuevo.',
      );
    } finally {
      setCheckingOut(false);
    }
  }, [pendingOrderId, paymentMethod, totalWithDelivery, phoneDigits]);

  // Payment success handler
  const handlePaymentSuccess = useCallback(
    (paymentId: string) => {
      setPaymentPending(false);
      setPaymentIntent(null);
      // El recibo usa el total congelado y el ID real del pedido (el
      // paymentId es del intent/proveedor y el tracking 404ea con él).
      setPlacedTotal(totalWithDelivery);
      setCart([]);
      setShowCheckout(false);
      const realOrderId = pendingOrderIdRef.current;
      setPendingOrderId(null);
      setOrderSuccess(realOrderId || paymentId);
    },
    [totalWithDelivery],
  );

  // Payment error handler
  const handlePaymentError = useCallback((error: string) => {
    setPaymentPending(false);
    setPaymentIntent(null);
    setCheckoutError(typeof error === 'string' ? error : 'Error en el pago.');
  }, []);

  // Order success screen
  if (orderSuccess) {
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
            role="img"
            aria-label="Pedido confirmado"
          >
            <PartyPopper className="h-16 w-16 inline" aria-hidden />
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            ¡Pedido Creado!
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mb-6">
            Tu pedido está buscando repartidor
          </p>

          <div className="rounded-2xl glass p-6 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Número</span>
                <span className="font-semibold text-surface-800 dark:text-surface-200">
                  #{orderSuccess.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Entregar en</span>
                <span className="font-medium text-surface-800 dark:text-surface-200 text-right max-w-[60%]">
                  {deliveryInfo.address}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500 dark:text-surface-400">Total</span>
                <span className="font-bold text-kiwi-700 dark:text-kiwi-400">
                  ₡{placedTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link href={`/tracking/${orderSuccess}`}>
              <AnimatedButton variant="gradient" className="w-full">
                <MapPin className="h-4 w-4 inline" /> Rastrear Pedido
              </AnimatedButton>
            </Link>
            <Link href="/">
              <AnimatedButton variant="secondary" className="w-full">
                <Home className="h-4 w-4 inline" /> Volver al inicio
              </AnimatedButton>
            </Link>
            <AnimatedButton
              variant="ghost"
              className="w-full"
              onClick={() => setOrderSuccess(null)}
            >
              ➕ Hacer otro pedido
            </AnimatedButton>
          </div>
        </motion.div>
      </main>
    );
  }

  // Loading state
  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 pb-32">
        <div className="pt-safe sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <div className="w-16" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-lg px-4 py-6">
          <div className="rounded-2xl glass p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-lg px-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl glass p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-20 w-20 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-3" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <motion.div
          className="text-center px-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            😕
          </motion.div>
          <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            No pudimos cargar el menú
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <AnimatedButton variant="secondary" onClick={() => router.push('/')}>
              ← Volver
            </AnimatedButton>
            <AnimatedButton variant="gradient" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 inline" /> Reintentar
            </AnimatedButton>
          </div>
        </motion.div>
      </main>
    );
  }

  // Merchant not found
  if (!merchant) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl mb-4 block">
            <X className="h-12 w-12 inline" />
          </span>
          <p className="text-surface-500 dark:text-surface-400">Comercio no encontrado</p>
          <Link href="/" className="mt-4 inline-block text-kiwi-700 hover:text-kiwi-800">
            ← Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 pb-32">
      {/* Header */}
      <motion.header
        className="pt-safe sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            {' '}
            <Link
              href="/"
              className="flex min-h-[44px] items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Menú
            </h1>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      {/* Restaurant Info */}
      <motion.div
        className="mx-auto max-w-lg px-4 py-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4 shadow-soft dark:shadow-dark">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-400/10 font-display text-2xl font-bold text-kiwi-700 dark:text-kiwi-300 overflow-hidden">
              {isHttpUrl(merchant.logoUrl) ? (
                <img
                  src={merchant.logoUrl}
                  alt={merchant.businessName}
                  className="h-16 w-16 object-cover"
                />
              ) : (
                merchant.businessName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                {merchant.businessName}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-surface-500 dark:text-surface-400">
                  <Star className="h-4 w-4 inline" /> {formatRating(merchant.rating)} (
                  {merchant.totalRatings})
                </span>
                <span className="text-sm text-surface-500 dark:text-surface-400">
                  <MapPin className="h-4 w-4 inline" /> {merchant.address}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    merchant.isOpen
                      ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400'
                      : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                  }`}
                >
                  {merchant.isOpen ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        className="mx-auto max-w-lg px-4 mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <TapButton
              key={cat}
              className={`inline-flex min-h-[44px] flex-shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-kiwi-700 text-white shadow-kiwi'
                  : `bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 shadow-soft dark:shadow-dark ${hoverChip}`
              }`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </TapButton>
          ))}
        </div>
      </motion.div>

      {/* Menu Items */}
      <motion.div
        className="mx-auto max-w-lg px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Utensils className="text-5xl mb-4 block h-12 w-12 mx-auto" />
            <p className="text-surface-500 dark:text-surface-400">
              No hay productos en esta categoría
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item, itemIndex) => {
              const quantity = getItemQuantity(item.id);
              return (
                <ScrollReveal key={item.id} index={itemIndex} as="div">
                  <motion.div
                    className={`rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4 shadow-soft dark:shadow-dark ${hoverCard}`}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-kiwi-50 dark:bg-surface-700 text-3xl flex-shrink-0 overflow-hidden">
                        {isHttpUrl(item.image) ? (
                          // NOTE: <img> intencional — avatares dinámicos de Cloudinary, next/image no aporta aquí
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover rounded-xl"
                          />
                        ) : isEmojiImage(item.image) ? (
                          <span className="text-5xl leading-none">{item.image}</span>
                        ) : (
                          <Utensils className="h-10 w-10 text-kiwi-600/60 dark:text-kiwi-400/60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                                {item.name}
                              </h3>
                              {item.isPopular && (
                                <span className="px-2 py-0.5 rounded-full bg-gold-100 dark:bg-gold-900/50 text-xs font-medium text-gold-700 dark:text-gold-400">
                                  🔥 Popular
                                </span>
                              )}
                              {(item.variantGroups ?? []).some((g) => g.options.length > 0) && (
                                <span className="px-2 py-0.5 rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-xs font-medium text-kiwi-700 dark:text-kiwi-400">
                                  Personalizable
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-lg font-bold text-kiwi-700 dark:text-kiwi-400">
                            ₡{item.price.toLocaleString()}
                          </p>
                          <div className="flex items-center gap-2">
                            {quantity > 0 && (
                              <motion.div
                                className="flex items-center gap-2"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                              >
                                <TapButton
                                  haptic
                                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                                  onClick={() => decrementMenuItem(item.id)}
                                >
                                  −
                                </TapButton>
                                <span className="w-6 text-center font-semibold text-surface-800 dark:text-surface-200">
                                  {quantity}
                                </span>
                              </motion.div>
                            )}
                            <TapButton
                              haptic
                              success
                              onSuccess={() => setCartBounceKey((k) => k + 1)}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-700 text-white shadow-kiwi"
                              onClick={() => addToCart(item)}
                              disabled={!merchant.isOpen}
                            >
                              +
                            </TapButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {picking && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPicking(null)}
          >
            <motion.div
              className="w-full max-w-lg rounded-3xl bg-white dark:bg-surface-800 p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                  {picking.name}
                </h3>
                <button
                  onClick={() => setPicking(null)}
                  aria-label="Cerrar opciones del producto"
                  className={`text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 px-2 ${hoverGhost}`}
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-surface-500 mb-4">
                Base ₡{Number(picking.price).toLocaleString()}
              </p>
              {(picking.variantGroups ?? []).map((g) => (
                <div key={g.id} className="mb-4">
                  <p className="mb-2 text-sm font-semibold text-surface-700 dark:text-surface-300">
                    {g.name}
                    {g.required && <span className="text-red-500"> *</span>}
                    {g.multiple && (
                      <span className="ml-1 text-xs font-normal text-surface-400">(varias)</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {g.options.map((o) => {
                      const active = (picks[g.id] ?? []).includes(o.id);
                      const soldOut = o.isAvailable === false;
                      return (
                        <button
                          key={o.id}
                          disabled={soldOut}
                          onClick={() => togglePick(g.id, o.id, g.multiple)}
                          className={`inline-flex min-h-[44px] items-center rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                            soldOut
                              ? 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 line-through opacity-60'
                              : active
                                ? 'bg-kiwi-700 text-white'
                                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'
                          }`}
                        >
                          {soldOut && <span className="mr-1">⛔</span>}
                          {o.name}
                          {Number(o.priceDelta) !== 0 && (
                            <span className="ml-1 opacity-80">
                              {Number(o.priceDelta) > 0 ? '+' : ''}₡
                              {Number(o.priceDelta).toLocaleString()}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {pickError && <p className="mb-3 text-sm text-red-500">{pickError}</p>}
              <button
                onClick={confirmPick}
                className="w-full rounded-2xl bg-kiwi-gradient py-3.5 font-semibold text-white shadow-kiwi-lg"
              >
                Agregar • ₡
                {unitPriceFor(
                  Number(picking.price),
                  (picking.variantGroups ?? []).flatMap((g) =>
                    (picks[g.id] ?? []).map((oid) => {
                      const o = g.options.find((x) => x.id === oid);
                      return {
                        groupId: g.id,
                        groupName: g.name,
                        optionId: oid,
                        optionName: o?.name ?? '',
                        priceDelta: Number(o?.priceDelta ?? 0),
                      };
                    }),
                  ),
                ).toLocaleString()}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cartCount > 0 && !showCheckout && (
          <motion.div
            className="fixed bottom-6 left-4 right-4 z-50 pb-safe"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
          >
            <motion.div
              className="mx-auto max-w-lg rounded-2xl bg-kiwi-gradient p-4 text-white shadow-kiwi-lg cursor-pointer"
              animate={cartBounceKey > 0 && !prefersReducedMotion ? 'bounce' : 'idle'}
              variants={{
                idle: { scale: 1 },
                bounce: {
                  scale: [1, 1.08, 0.96, 1.03, 1],
                  transition: { duration: 0.5, ease: 'easeInOut' },
                },
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCheckout(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <motion.span
                      key={cartBounceKey}
                      className="font-bold"
                      initial={cartBounceKey > 0 && !prefersReducedMotion ? { scale: 1.5 } : false}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    >
                      {cartCount}
                    </motion.span>
                  </div>
                  <span className="font-semibold">Ver carrito</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/80">Total:</span>
                  <span className="text-xl font-bold">₡{cartTotal.toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckout && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowCheckout(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Handle */}
              <div className="pt-safe sticky top-0 bg-white dark:bg-surface-800 pt-4 pb-2 px-6 border-b border-surface-100 dark:border-surface-700 rounded-t-3xl sm:rounded-t-3xl">
                <div className="w-12 h-1 bg-surface-300 dark:bg-surface-600 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                    <ShoppingCart className="h-4 w-4 inline" /> Tu Pedido
                  </h2>
                  <TapButton
                    onClick={() => setShowCheckout(false)}
                    className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  >
                    ✕
                  </TapButton>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Order Summary */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                    <Package className="h-4 w-4 inline" /> Resumen
                  </h3>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.lineId} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isHttpUrl(item.image) ? (
                            // NOTE: <img> intencional — avatares dinámicos de Cloudinary
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-6 w-6 rounded object-cover"
                            />
                          ) : isEmojiImage(item.image) ? (
                            <span className="text-xl">{item.image}</span>
                          ) : (
                            <Utensils className="text-xl h-6 w-6" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                              {item.name}
                            </p>
                            {item.selectedOptions.length > 0 && (
                              <p className="text-xs text-surface-500">
                                {item.selectedOptions.map((s) => s.optionName).join(' · ')}
                              </p>
                            )}
                            <p className="text-xs text-surface-400">x{item.quantity}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                            ₡{(item.unitPrice * item.quantity).toLocaleString()}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.lineId)}
                            className="text-surface-500 hover:text-red-500 text-sm px-1"
                            aria-label={`Quitar ${item.name} del pedido`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Address */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                    <MapPin className="h-4 w-4 inline" /> Dirección de entrega
                  </h3>

                  <AddressInput
                    value={deliveryInfo.address}
                    onChange={(address, coordinates) => {
                      setDeliveryInfo({ ...deliveryInfo, address });
                      if (coordinates) {
                        void coordinates;
                      }
                    }}
                    placeholder="Buscar dirección en Nicoya..."
                    nicoyaOnly={true}
                  />
                  <div className="mt-3">
                    <DeliveryZoneSelect
                      value={deliveryInfo.zone}
                      onChange={(zone) => setDeliveryInfo({ ...deliveryInfo, zone })}
                    />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                      <User className="h-4 w-4 inline" /> Nombre
                    </h3>
                    <input
                      type="text"
                      value={deliveryInfo.name}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, name: e.target.value })}
                      placeholder="Tu nombre"
                      className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20 transition-all"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                      <Smartphone className="h-4 w-4 inline" /> Teléfono
                    </h3>
                    <input
                      type="tel"
                      value={deliveryInfo.phone}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                      placeholder="8888-1234"
                      className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20 transition-all"
                    />
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                    <FileText className="h-4 w-4 inline" /> Instrucciones (opcional)
                  </h3>
                  <textarea
                    value={deliveryInfo.instructions}
                    onChange={(e) =>
                      setDeliveryInfo({ ...deliveryInfo, instructions: e.target.value })
                    }
                    placeholder="Ej: Tocar el timbre, dejar en recepción, sin cebolla..."
                    rows={2}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20 transition-all resize-none"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                    <CreditCard className="h-4 w-4 inline" /> Método de pago
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        id: 'sinpe' as const,
                        icon: Smartphone,
                        label: 'SINPE',
                        desc: 'Transferencia',
                      },
                      {
                        id: 'card' as const,
                        icon: CreditCard,
                        label: 'Tarjeta',
                        desc: 'Crédito/Débito',
                      },
                      {
                        id: 'cash' as const,
                        icon: DollarSign,
                        label: 'Efectivo',
                        desc: 'Al repartidor',
                      },
                    ]
                      .filter((method) => (payAvailability as Record<string, boolean>)[method.id])
                      .map((method) => {
                        const MethodIcon = method.icon as any;
                        return (
                          <motion.button
                            key={method.id}
                            type="button"
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                              paymentMethod === method.id
                                ? 'bg-kiwi-100 dark:bg-kiwi-900/50 ring-2 ring-kiwi-600 shadow-kiwi'
                                : 'bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600'
                            }`}
                            onClick={() => setPaymentMethod(method.id)}
                            whileTap={{ scale: 0.95 }}
                          >
                            <span className="text-2xl">
                              {typeof method.icon === 'string' ? (
                                method.icon
                              ) : (
                                <MethodIcon className="h-6 w-6" />
                              )}
                            </span>
                            <span
                              className={`text-sm font-semibold ${
                                paymentMethod === method.id
                                  ? 'text-kiwi-700 dark:text-kiwi-400'
                                  : 'text-surface-700 dark:text-surface-300'
                              }`}
                            >
                              {method.label}
                            </span>
                            <span className="text-xs text-surface-500 dark:text-surface-400">
                              {method.desc}
                            </span>
                            {paymentMethod === method.id && (
                              <motion.div
                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-kiwi-700 text-white text-xs flex items-center justify-center"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 500 }}
                              >
                                ✓
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                  </div>

                  {/* Crypto Options */}
                  {payAvailability.crypto && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {[
                        {
                          id: 'crypto_usdc' as const,
                          icon: DollarSign,
                          label: 'USDC',
                          desc: 'Stellar',
                        },
                        {
                          id: 'crypto_usdt' as const,
                          icon: DollarSign,
                          label: 'USDT',
                          desc: 'Stellar',
                        },
                      ].map((method) => {
                        const CryptoIcon = method.icon as any;
                        return (
                          <motion.button
                            key={method.id}
                            type="button"
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                              paymentMethod === method.id
                                ? 'bg-purple-100 dark:bg-purple-900/50 ring-2 ring-purple-500 shadow-purple'
                                : 'bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600'
                            }`}
                            onClick={() => setPaymentMethod(method.id)}
                            whileTap={{ scale: 0.95 }}
                          >
                            <span className="text-xl">
                              {typeof method.icon === 'string' ? (
                                method.icon
                              ) : (
                                <CryptoIcon className="h-6 w-6" />
                              )}
                            </span>
                            <div className="text-left">
                              <span
                                className={`text-sm font-semibold ${
                                  paymentMethod === method.id
                                    ? 'text-purple-700 dark:text-purple-400'
                                    : 'text-surface-700 dark:text-surface-300'
                                }`}
                              >
                                {method.label}
                              </span>
                              <span className="text-xs text-surface-500 dark:text-surface-400 block">
                                {method.desc}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                      {(paymentMethod === 'crypto_usdc' || paymentMethod === 'crypto_usdt') && (
                        <div className="col-span-2">
                          <CryptoRateNote
                            amountCRC={totalWithDelivery}
                            coin={paymentMethod === 'crypto_usdc' ? 'USDC' : 'USDT'}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* SINPE Phone Input */}
                  {paymentMethod === 'sinpe' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3"
                    >
                      <input
                        type="tel"
                        value={deliveryInfo.phone}
                        onChange={(e) =>
                          setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })
                        }
                        placeholder="Número SINPE (8888-1234)"
                        className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20 transition-all"
                      />
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                        Se enviará un cobro SINPE a este número
                      </p>
                    </motion.div>
                  )}

                  {/* Cash Info */}
                  {paymentMethod === 'cash' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 rounded-xl bg-gold-50 dark:bg-gold-900/30 p-3"
                    >
                      <p className="text-sm text-gold-700 dark:text-gold-400">
                        <DollarSign className="h-4 w-4 inline" /> Paga en efectivo al repartidor
                        cuando te entreguen tu pedido
                      </p>
                    </motion.div>
                  )}

                  {/* Card Info */}
                  {paymentMethod === 'card' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 p-3"
                    >
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        <CreditCard className="h-4 w-4 inline" /> Se te redirigirá a OnvoPay para
                        completar el pago seguro
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Price Summary */}
                <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">Subtotal</span>
                      <span className="text-surface-800 dark:text-surface-200">
                        ₡{cartTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">Envío</span>
                      <span
                        className={
                          deliveryFee === 0
                            ? 'text-kiwi-700 dark:text-kiwi-400 font-medium'
                            : 'text-surface-800 dark:text-surface-200'
                        }
                      >
                        {deliveryFee === 0 ? (
                          <span className="inline-flex items-center gap-1">
                            Gratis <PartyPopper className="h-4 w-4 inline" />
                          </span>
                        ) : (
                          `₡${deliveryFee.toLocaleString()}`
                        )}
                      </span>
                    </div>
                    <div className="border-t border-surface-200 dark:border-surface-700 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-surface-800 dark:text-surface-200">
                          Total
                        </span>
                        <span className="text-xl font-bold text-kiwi-700 dark:text-kiwi-400">
                          ₡{totalWithDelivery.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkout Button */}
                {checkoutError && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-400"
                  >
                    {checkoutError}
                  </p>
                )}
                <AnimatedButton
                  variant="gradient"
                  className="w-full"
                  onClick={() => {
                    setCheckoutError(null);
                    void handleCheckout();
                  }}
                  disabled={!canCheckout || checkingOut}
                >
                  {checkingOut ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="flex"
                      >
                        <Clock className="h-5 w-5" />
                      </motion.span>
                      Creando pedido...
                    </span>
                  ) : (
                    `🚀 Pedir • ₡${totalWithDelivery.toLocaleString()}`
                  )}
                </AnimatedButton>

                {!canCheckout && (
                  <p className="text-xs text-center text-surface-400">
                    Completa nombre, dirección y teléfono para continuar
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentPending && paymentIntent && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setPaymentPending(false);
                setPaymentIntent(null);
              }}
            />

            {/* Payment Component */}
            <motion.div
              className="relative w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              {paymentMethod === 'crypto_usdc' || paymentMethod === 'crypto_usdt' ? (
                <CryptoCheckout
                  walletAddress={paymentIntent.walletAddress || ''}
                  amount={totalWithDelivery}
                  amountInCrypto={paymentIntent.amountInCrypto || 0}
                  coin={paymentMethod === 'crypto_usdc' ? 'USDC' : 'USDT'}
                  qrCode={paymentIntent.qrCode}
                  onSuccess={() => handlePaymentSuccess(paymentIntent.paymentId)}
                  onError={handlePaymentError}
                />
              ) : (
                <OnvoPayCheckout
                  paymentIntentId={paymentIntent.paymentId || ''}
                  clientSecret={paymentIntent.clientSecret || ''}
                  checkoutUrl={paymentIntent.checkoutUrl}
                  amount={totalWithDelivery}
                  currency="CRC"
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onCancel={() => {
                    setPaymentPending(false);
                    setPaymentIntent(null);
                  }}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Closed Store Banner */}
      {!merchant.isOpen && (
        <motion.div
          className="pb-safe fixed bottom-0 left-0 right-0 bg-red-500/90 text-white p-4 text-center backdrop-blur-xl"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
        >
          <p className="font-semibold">🚫 Este negocio está cerrado ahora</p>
          <p className="text-sm text-white/80">Intenta más tarde</p>
        </motion.div>
      )}
    </main>
  );
}
