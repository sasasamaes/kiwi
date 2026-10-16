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
  Lock,
  Instagram,
  Facebook,
  MessageCircle,
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
  ZonePicker,
  useDeliveryZones,
  OnvoPayCheckout,
  CryptoCheckout,
  CryptoRateNote,
  safeNavigateToUrl,
  useAuth,
  KiwiMark,
  isEmojiImage,
  isHttpUrl,
  hoverCard,
  hoverChip,
  hoverGhost,
  ThemeToggle,
  SchedulePicker,
  EMPTY_SCHEDULE,
  isValidSchedule,
  scheduleFields,
  tomorrowKeyCR,
  weekdayNameES,
  formatOpeningHours,
} from '@kiwi/ui';
import type { ScheduleValue } from '@kiwi/ui';
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
  // Zonas desde la DB (editables en el admin); el precio mostrado sale de acá.
  const deliveryZones = useDeliveryZones();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [zoneAuto, setZoneAuto] = useState(false);
  const [profilePrefilled, setProfilePrefilled] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  // Producto en el picker de variantes (null = picker cerrado).
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [pickError, setPickError] = useState<string | null>(null);
  // Preventa (cocinas caseras): pedir hoy para recibir el día que toca.
  const [schedule, setSchedule] = useState<ScheduleValue>(EMPTY_SCHEDULE);
  // Seguir al comercio: avisos de ventas por fecha y reposiciones de stock.
  // null = sin cuenta o sin cargar (el botón igual se muestra e invita).
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  // Efectivo: con cuánto paga (opcional; si viene debe cubrir el total).
  const [cashTendered, setCashTendered] = useState('');

  // Delivery info
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    address: '',
    phone: '',
    name: '',
    instructions: '',
    zone: '',
  });

  // Auth del comprador (para elegir endpoint de pedido/pago por rol).
  const { user } = useAuth();
  const userRole = (user as any)?.role as string | undefined;

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

  // Tarjeta/SINPE solo si el comercio pasó el KYC de Onvo (flag del admin).
  // Sin eso el backend rechaza el cobro: se muestran inactivos en gris.
  const cardAllowed = (merchant as any)?.cardPaymentsEnabled === true;
  // Toggles del propio comercio (perfil): efectivo y SINPE.
  const cashAllowed = (merchant as any)?.cashEnabled !== false;
  const sinpeAllowed = cardAllowed && (merchant as any)?.sinpeEnabled !== false;
  const payWithAuthedEndpoint =
    !!api.getToken() && (userRole === 'customer' || userRole === 'merchant');

  // Cuadro habilitado = flag de plataforma + toggles del comercio
  // (SINPE/tarjeta además exigen KYC Onvo). Si el método elegido se apaga,
  // Pedir se desactiva: una selección vieja no debe dejar pedir.
  const isPayMethodEnabled = useCallback(
    (id: PaymentMethod): boolean => {
      if (id === 'crypto_usdc' || id === 'crypto_usdt') return payAvailability.crypto;
      if (!(payAvailability as Record<string, boolean>)[id]) return false;
      if (id === 'cash' && !cashAllowed) return false;
      if (id === 'sinpe' && !sinpeAllowed) return false;
      if (id === 'card' && !cardAllowed) return false;
      return true;
    },
    [payAvailability, cardAllowed, cashAllowed, sinpeAllowed],
  );

  // Si el método elegido deja de estar disponible (flag del comercio o
  // settings), caer a uno válido en vez de dejar un botón muerto.
  useEffect(() => {
    setPaymentMethod((prev) => {
      if (isPayMethodEnabled(prev)) return prev;
      const fallback: PaymentMethod[] = ['cash', 'sinpe', 'card', 'crypto_usdc'];
      return fallback.find((f) => isPayMethodEnabled(f)) ?? prev;
    });
  }, [isPayMethodEnabled]);

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
  useSocket();

  // Logueado: el checkout se autorrellena con tu perfil (nombre,
  // dirección, barrio, teléfono) y lo que cambies se guarda para la próxima.
  useEffect(() => {
    if (!showCheckout || profilePrefilled || userRole !== 'customer') return;
    setProfilePrefilled(true);
    void (async () => {
      try {
        const [profile, me] = await Promise.all([
          api.getCustomerProfile().catch(() => null),
          api.getProfile().catch(() => null),
        ]);
        setDeliveryInfo((prev) => ({
          address: prev.address || (profile as any)?.defaultAddress || '',
          phone: prev.phone || (me as any)?.phone || '',
          name: prev.name || (profile as any)?.fullName || '',
          instructions: prev.instructions,
          zone: prev.zone || (profile as any)?.deliveryZone || '',
        }));
        const plat = Number((profile as any)?.latitude);
        const plng = Number((profile as any)?.longitude);
        if (Number.isFinite(plat) && Number.isFinite(plng)) {
          setDeliveryCoords((prev) => prev ?? { lat: plat, lng: plng });
        }
      } catch {
        // invitado o sin perfil: el form manual sigue funcionando
      }
    })();
  }, [showCheckout, profilePrefilled, userRole]);

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

  // ¿Sigo a este comercio? Solo con cuenta de cliente; invitados ven el
  // botón que los manda a crear cuenta (el 401 del API redirige a login).
  useEffect(() => {
    if (!api.getToken() || (userRole !== undefined && userRole !== 'customer')) {
      setFollowing(null);
      return;
    }
    let cancelled = false;
    api
      .getMyFollows()
      .then((list) => {
        if (!cancelled) setFollowing(list.some((f) => f.id === merchantId));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [merchantId, userRole]);

  const toggleFollow = useCallback(async () => {
    if (followBusy) return;
    if (!api.getToken()) {
      router.push('/register');
      return;
    }
    setFollowBusy(true);
    const next = !(following === true);
    setFollowing(next);
    try {
      if (next) await api.followMerchant(merchantId);
      else await api.unfollowMerchant(merchantId);
    } catch {
      setFollowing(!next);
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, following, merchantId, router]);

  // Otro comercio (navegación cliente entre menús): carrito, zona y pedido
  // pendiente son del anterior — resetear para no cobrarle a quien no es.
  useEffect(() => {
    setCart([]);
    setDeliveryInfo({ address: '', phone: '', name: '', instructions: '', zone: '' });
    setDeliveryCoords(null);
    setZoneAuto(false);
    setProfilePrefilled(false);
    setPendingOrderId(null);
    setOrderSuccess(null);
    setShowCheckout(false);
    setPaymentPending(false);
    setPaymentIntent(null);
    setSchedule(EMPTY_SCHEDULE);
    setCashTendered('');
    setFollowing(null);
    setFollowBusy(false);
  }, [merchantId]);

  // Ubicación del cliente → resolver zona en la DB (polígono) y autoseleccionar
  // su precio. No pisa una elección manual del barrio.
  useEffect(() => {
    if (!deliveryCoords) return;
    let alive = true;
    api
      .resolveDeliveryZone(deliveryCoords.lat, deliveryCoords.lng)
      .then((r) => {
        if (!alive || !r.zone) return;
        const zone = r.zone;
        setDeliveryInfo((prev) => (prev.zone ? prev : { ...prev, zone: zone.id }));
        setZoneAuto(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [deliveryCoords]);

  // Cart functions
  const addLine = useCallback((item: MenuItem, selected: SelectedOption[]) => {
    const lineId = lineIdFor(item.id, selected);
    const unitPrice = unitPriceFor(Number(item.price), selected);
    events.menu.itemAdded(item.id, item.name, unitPrice);
    setCart((prev) => {
      // Stock del día: no deja pedir más de lo que queda (el backend
      // revalida atómico; esto es solo para no frustrar en el +).
      const stock = (item as any).stockQty as number | null | undefined;
      if (typeof stock === 'number') {
        const inCart = prev.filter((c) => c.id === item.id).reduce((s, c) => s + c.quantity, 0);
        if (inCart >= stock) return prev;
      }
      const existing = prev.find((c) => c.lineId === lineId);
      if (existing) {
        return prev.map((c) => (c.lineId === lineId ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { ...item, lineId, unitPrice, selectedOptions: selected, quantity: 1 }];
    });
  }, []);

  const addToCart = useCallback(
    (item: MenuItem) => {
      // Item de mañana: la preventa queda preset para mañana (el cliente
      // solo elige la hora en el checkout).
      if ((item as any).offeredTomorrow) {
        setSchedule((prev) => ({ ...prev, mode: 'scheduled', date: tomorrowKeyCR() }));
      }
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

  const togglePick = useCallback(
    (groupId: string, optionId: string, multiple: boolean, max?: number | null) => {
      setPicks((prev) => {
        const current = prev[groupId] ?? [];
        if (multiple) {
          if (current.includes(optionId)) {
            return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
          }
          // Tope del grupo (ej. máximo 3 frutas): no suma de más.
          if (typeof max === 'number' && current.length >= max) return prev;
          return { ...prev, [groupId]: [...current, optionId] };
        }
        return { ...prev, [groupId]: [optionId] };
      });
    },
    [],
  );

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
    if ((picking as any).offeredTomorrow) {
      setSchedule((prev) => ({ ...prev, mode: 'scheduled', date: tomorrowKeyCR() }));
    }
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
  // Cargo por servicio Kiwi: % extra sobre productos (15% standard, 10%
  // cocina casera). El envío es SIEMPRE el precio del barrio (sin
  // "gratis +₡5000": el servidor no tiene esa regla). El backend cobra el
  // total real; esto es espejo para mostrar el desglose.
  const [feeRates, setFeeRates] = useState({ standardPct: 15, homeCookPct: 10 });
  useEffect(() => {
    api
      .getPlatformFees()
      .then((f) => setFeeRates(f))
      .catch(() => undefined);
  }, []);
  const servicePct =
    ((merchant as any)?.isHomeCook ? feeRates.homeCookPct : feeRates.standardPct) / 100;
  // Kiwi ya no le cobra "servicio" al cliente: la comisión de productos la paga
  // el comercio (por factura, en pedidos de la app).
  const serviceFee = 0;
  // El envío se cobra con +15% de Kiwi; el repartidor recibe el viaje base.
  const tripPct = feeRates.standardPct / 100;
  const zoneTrip =
    deliveryZones.find((z) => z.id === deliveryInfo.zone)?.price ??
    findDeliveryZone(deliveryInfo.zone)?.price ??
    null;
  const deliveryFee = Math.round((zoneTrip ?? 500) * (1 + tripPct));
  const totalWithDelivery = cartTotal + deliveryFee;

  /** Solo dígitos para validar y para el email invitado. */
  const phoneDigits = deliveryInfo.phone.replace(/\D/g, '');

  // Filter items by category
  const filteredItems =
    selectedCategory === 'Todos'
      ? menuItems
      : menuItems.filter((item) => item.category === selectedCategory);

  // Builder "Crea tu Bowl": producto personalizable del comercio cuyo nombre
  // matchea. Sin hardcodear IDs ni precios: todo sale de menuItems ya cargados.
  const builderItem = menuItems.find(
    (item) =>
      /crea tu bowl/i.test(item.name) &&
      (item.variantGroups ?? []).some((g) => g.options.length > 0),
  );
  // El builder vive en la hero card; no se repite en la lista normal.
  const visibleItems = builderItem
    ? filteredItems.filter((item) => item.id !== builderItem.id)
    : filteredItems;
  // Vitrina de mañana: lo de mañana se vende hoy solo en preventa.
  const tomorrowKey = tomorrowKeyCR();
  const tomorrowItems =
    selectedCategory === 'Todos' ? menuItems.filter((i) => (i as any).offeredTomorrow) : [];
  const todayItems = visibleItems.filter((i) => !(i as any).offeredTomorrow);
  // Si el carrito trae algo de mañana, el pedido entero es programado para
  // mañana (un pedido = una fecha de entrega).
  const cartHasTomorrow = cart.some((c) => (c as any).offeredTomorrow);

  // Validate checkout
  // Cocina casera cerrada hoy igual acepta preventa futura (ej. lunes pido
  // para el jueves): el isOpen solo bloquea el "lo quiero ahora".
  const schedulingFuture = schedule.mode === 'scheduled' && isValidSchedule(schedule);
  const cashCovers =
    paymentMethod !== 'cash' || cashTendered === '' || Number(cashTendered) >= totalWithDelivery;
  const canCheckout =
    deliveryInfo.address.trim().length > 0 &&
    deliveryInfo.zone.trim().length > 0 &&
    phoneDigits.length >= 8 &&
    deliveryInfo.name.trim().length > 0 &&
    isValidSchedule(schedule) &&
    cashCovers &&
    isPayMethodEnabled(paymentMethod) &&
    (merchant?.isOpen !== false || schedulingFuture) &&
    (!cartHasTomorrow || (schedule.mode === 'scheduled' && schedule.date === tomorrowKey));

  // Anti-duplicados (doble tap con wifi caído = N pedidos): el state
  // llega tarde al segundo tap; el ref no. La key se reusa en reintentos
  // para que el backend devuelva el mismo pedido.
  const checkingOutRef = useRef(false);
  // Key de idempotencia ligada al comercio: el backend deduplica por
  // merchantId + idempotencyKey, así que reusar la key al cambiar de
  // comercio no aplica. Se limpia al completar un pedido (nunca se reusa
  // para uno nuevo del mismo comercio).
  const checkoutKeyRef = useRef<{ merchantId: string; key: string } | null>(null);
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
        const paymentResult = payWithAuthedEndpoint
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
        const paymentResult = payWithAuthedEndpoint
          ? await api.createPayment(retryCrypto)
          : await api.createGuestPayment(retryCrypto);
        setPaymentIntent(paymentResult);
        setPaymentPending(true);
      } else {
        setPlacedTotal(totalWithDelivery);
        setCart([]);
        setShowCheckout(false);
        setPendingOrderId(null);
        checkoutKeyRef.current = null;
        setOrderSuccess(pendingOrderId);
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'No se pudo reintentar el pago. Intentá de nuevo.',
      );
    } finally {
      setCheckingOut(false);
    }
  }, [pendingOrderId, paymentMethod, totalWithDelivery, phoneDigits, payWithAuthedEndpoint]);

  // Checkout handler
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0 || !merchant || !canCheckout) return;
    if (merchant.isOpen === false && !schedulingFuture) return;

    // Pago pendiente de un pedido ya creado: reintentar SOLO el pago.
    if (pendingOrderId) {
      await retryPendingPayment();
      return;
    }
    if (checkingOutRef.current) return;
    checkingOutRef.current = true;
    if (!checkoutKeyRef.current || checkoutKeyRef.current.merchantId !== merchant.id) {
      checkoutKeyRef.current = {
        merchantId: merchant.id,
        key:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    }

    setCheckingOut(true);
    try {
      const orderData = {
        merchantId: merchant.id,
        pickupAddress: merchant.address,
        deliveryAddress: deliveryInfo.address,
        deliveryZone: deliveryInfo.zone,
        ...scheduleFields(schedule),
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
        ...(paymentMethod === 'cash' && cashTendered !== ''
          ? { cashTendered: Number(cashTendered) }
          : {}),
      };

      const order =
        api.getToken() && userRole === 'customer'
          ? await api.createCustomerOrder(orderData, {
              idempotencyKey: checkoutKeyRef.current!.key,
            })
          : api.getToken() && userRole === 'merchant'
            ? await api.createOrder(orderData, { idempotencyKey: checkoutKeyRef.current!.key })
            : await api.createGuestOrder(orderData, {
                idempotencyKey: checkoutKeyRef.current!.key,
              });
      setPendingOrderId(order.id);

      // Logueado: guarda estos datos en tu perfil para futuras compras
      // (dirección, barrio, teléfono, GPS). Best-effort, no bloquea el pago.
      if (userRole === 'customer') {
        void api
          .updateCustomerProfile({
            fullName: deliveryInfo.name.trim() || undefined,
            defaultAddress: deliveryInfo.address.trim() || undefined,
            deliveryZone: deliveryInfo.zone || undefined,
            ...(deliveryCoords
              ? { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng }
              : {}),
          })
          .catch(() => undefined);
      }

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
        const paymentResult = payWithAuthedEndpoint
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
        const paymentResult = payWithAuthedEndpoint
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
    deliveryCoords,
    canCheckout,
    schedulingFuture,
    schedule,
    paymentMethod,
    totalWithDelivery,
    phoneDigits,
    pendingOrderId,
    userRole,
    payWithAuthedEndpoint,
  ]);

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
      // Pedido completo: liberar la key para que el próximo pedido del
      // mismo comercio genere una nueva (si no, el backend lo deduplica
      // como si fuera un reintento y devuelve el pedido anterior).
      checkoutKeyRef.current = null;
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

          <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 mb-6">
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
          <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4">
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
              <div
                key={i}
                className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
              >
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
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100 flex items-center gap-2">
              <KiwiMark size={22} />
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
              ) : isEmojiImage(merchant.logoUrl) ? (
                <span className="text-4xl leading-none">{merchant.logoUrl}</span>
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
                {merchant.isHomeCook && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300">
                    🧡 Cocina casera
                  </span>
                )}
              </div>
            </div>
          </div>
          <TapButton
            haptic
            onClick={() => void toggleFollow()}
            className={`mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              following === true
                ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'
            }`}
          >
            {followBusy
              ? '…'
              : following === true
                ? '✓ Siguiendo · te aviso ventas y stock'
                : '🔔 Seguir · avisame ventas y stock'}
          </TapButton>
          {(() => {
            const socials = (merchant as any)?.socials as Record<string, string> | null;
            const hours = formatOpeningHours((merchant as any)?.openingHours);
            if (!socials && !hours) return null;
            const links = [
              socials?.instagram
                ? { href: socials.instagram, label: 'Instagram', Icon: Instagram }
                : null,
              socials?.facebook
                ? { href: socials.facebook, label: 'Facebook', Icon: Facebook }
                : null,
              socials?.tiktok ? { href: socials.tiktok, label: 'TikTok', Icon: null } : null,
              socials?.whatsapp
                ? { href: socials.whatsapp, label: 'WhatsApp', Icon: MessageCircle }
                : null,
            ].filter(Boolean) as Array<{ href: string; label: string; Icon: any }>;
            return (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${merchant.businessName} en ${l.label}`}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-surface-100 dark:bg-surface-700 px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-300"
                  >
                    {l.Icon ? (
                      <l.Icon className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-bold">TikTok</span>
                    )}
                    {l.label}
                  </a>
                ))}
                {hours && (
                  <details className="inline-flex items-center">
                    <summary className="inline-flex min-h-[40px] cursor-pointer list-none items-center gap-1.5 rounded-full bg-surface-100 dark:bg-surface-700 px-3 py-2 text-xs font-semibold text-surface-600 dark:text-surface-300">
                      <Clock className="h-4 w-4" /> {hours.today}
                    </summary>
                    <div className="mt-2 w-full rounded-xl bg-surface-50 dark:bg-surface-900 p-3 text-xs text-surface-600 dark:text-surface-300">
                      {hours.week.map((line) => (
                        <p key={line} className="py-0.5">
                          {line}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })()}
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
              className={`inline-flex min-h-[44px] flex-shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-kiwi-700 text-white'
                  : `bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 shadow-soft dark:shadow-dark hover:bg-surface-100 dark:hover:bg-surface-700 ${hoverChip}`
              }`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </TapButton>
          ))}
        </div>
      </motion.div>

      {/* Builder hero: solo si el comercio cargó el producto "Crea tu Bowl" */}
      {builderItem && selectedCategory === 'Todos' && (
        <motion.div
          className="mx-auto max-w-lg px-4 mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div
            className={`rounded-2xl bg-kiwi-700 dark:bg-kiwi-800 p-5 shadow-soft dark:shadow-dark text-white ${hoverCard}`}
          >
            <p className="font-display text-lg font-bold">Crea tu Bowl</p>
            <p className="text-sm text-white/80 mt-1">
              Elegí tamaño, base, 3 frutas, 3 toppings y extras
            </p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-lg font-bold">Desde ₡{builderItem.price.toLocaleString()}</p>
              <TapButton
                haptic
                className="inline-flex min-h-[44px] items-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-kiwi-800"
                onClick={() => addToCart(builderItem)}
                disabled={!merchant?.isOpen}
              >
                Armar el mío +
              </TapButton>
            </div>
          </div>
        </motion.div>
      )}

      {/* Menu Items */}
      <motion.div
        className="mx-auto max-w-lg px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {todayItems.length === 0 && tomorrowItems.length === 0 ? (
          <div className="text-center py-12 px-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-kiwi-100 dark:bg-kiwi-400/10">
              <Utensils className="h-10 w-10 text-kiwi-600/70 dark:text-kiwi-400/70" />
            </div>
            <p className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Este restaurante aún no tiene productos aquí
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 mb-6">
              Estamos esperando que cargue su menú. Probá con otro restaurante mientras tanto.
            </p>
            <Link href="/">
              <AnimatedButton variant="gradient" className="w-full">
                ← Ver restaurantes
              </AnimatedButton>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {todayItems.map((item, itemIndex) => {
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
                            <div className="flex shrink-0 items-center gap-2">
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
                            {(item as any).stockQty != null && (item as any).stockQty <= 10 && (
                              <p className="mt-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
                                ¡Solo quedan {(item as any).stockQty} hoy! · Hasta agotar stock
                              </p>
                            )}
                            {((item as any).stockQty == null || (item as any).stockQty > 10) &&
                              (item as any).dailyQty != null && (
                                <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                                  Hasta agotar stock del día
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
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-700 text-white"
                              onClick={() => addToCart(item)}
                              disabled={
                                !merchant.isOpen ||
                                ((item as any).stockQty != null &&
                                  quantity >= (item as any).stockQty)
                              }
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

      {/* Vitrina de mañana: se vende mañana, se aparta hoy (hasta agotar stock) */}
      {tomorrowItems.length > 0 && (
        <motion.div
          className="mx-auto max-w-lg px-4 mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="rounded-2xl bg-orange-600 dark:bg-orange-700 p-4 shadow-soft text-white">
            <p className="font-display text-base font-bold">
              📅 Mañana {weekdayNameES(tomorrowKey)} venden esto
            </p>
            <p className="text-xs text-white/85 mt-0.5">
              Apartá el tuyo hoy en preventa — hasta agotar stock.
            </p>
          </div>
          <div className="space-y-4 mt-4">
            {tomorrowItems.map((item, itemIndex) => {
              const quantity = getItemQuantity(item.id);
              const stockLeft = (item as any).stockQty as number | null | undefined;
              const stockCapped = typeof stockLeft === 'number' && quantity >= stockLeft;
              return (
                <ScrollReveal key={item.id} index={itemIndex} as="div">
                  <motion.div
                    className={`rounded-2xl bg-white dark:bg-surface-800 border-2 border-orange-500/40 dark:border-orange-400/30 p-4 shadow-soft dark:shadow-dark ${hoverCard}`}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-orange-50 dark:bg-surface-700 text-3xl flex-shrink-0 overflow-hidden">
                        {isHttpUrl(item.image) ? (
                          // NOTE: <img> intencional — avatares dinámicos de Cloudinary
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover rounded-xl"
                          />
                        ) : isEmojiImage(item.image) ? (
                          <span className="text-5xl leading-none">{item.image}</span>
                        ) : (
                          <Utensils className="h-10 w-10 text-orange-500/60 dark:text-orange-400/60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                            {item.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/50 text-xs font-medium text-orange-700 dark:text-orange-300">
                            📅 Mañana
                          </span>
                        </div>
                        {(item as any).fulfillNote && (
                          <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mt-1">
                            🚚 {(item as any).fulfillNote}
                          </p>
                        )}
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                          {typeof stockLeft === 'number'
                            ? stockLeft > 0
                              ? `Hasta agotar stock · quedan ${stockLeft}`
                              : 'Agotado'
                            : 'Hasta agotar stock'}
                        </p>
                        <div className="flex items-center justify-between mt-2">
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
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-white"
                              onClick={() => addToCart(item)}
                              disabled={stockCapped}
                              title={stockCapped ? 'Sin stock' : 'Apartar para mañana'}
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
        </motion.div>
      )}

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
                      <span className="ml-1 text-xs font-normal text-surface-400">
                        {typeof g.maxSelections === 'number'
                          ? `(${(picks[g.id] ?? []).length} de ${g.maxSelections})`
                          : '(varias)'}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {g.options.map((o) => {
                      const active = (picks[g.id] ?? []).includes(o.id);
                      const soldOut = o.isAvailable === false;
                      const capped =
                        !active &&
                        g.multiple &&
                        typeof g.maxSelections === 'number' &&
                        (picks[g.id] ?? []).length >= g.maxSelections;
                      return (
                        <button
                          key={o.id}
                          disabled={soldOut || capped}
                          onClick={() => togglePick(g.id, o.id, g.multiple, g.maxSelections)}
                          className={`inline-flex min-h-[44px] items-center rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                            soldOut
                              ? 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 line-through opacity-60'
                              : active
                                ? 'bg-kiwi-700 text-white'
                                : capped
                                  ? 'bg-surface-100 dark:bg-surface-800 text-surface-400 dark:text-surface-500 opacity-50'
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
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl shadow-2xl"
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
                      <div key={item.lineId} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
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
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium text-surface-800 dark:text-surface-200">
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

                {/* Preventa (solo cocinas caseras): pedir hoy, recibir el día que toca */}
                {(merchant.isHomeCook || tomorrowItems.length > 0) && (
                  <div>
                    <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                      📅 ¿Para cuándo?
                    </h3>
                    <SchedulePicker
                      value={schedule}
                      onChange={setSchedule}
                      hint={
                        cartHasTomorrow
                          ? `Tu pedido incluye productos de mañana: sale programado para mañana ${weekdayNameES(tomorrowKey)}. Elegí la hora.`
                          : 'Acepta pedidos aunque hoy esté cerrada: programá para su día de venta.'
                      }
                    />
                  </div>
                )}

                {/* Delivery Address */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
                    <MapPin className="h-4 w-4 inline" /> Dirección de entrega
                  </h3>
                  <AddressInput
                    value={deliveryInfo.address}
                    onChange={(address, coordinates) => {
                      setDeliveryInfo((prev) => ({ ...prev, address }));
                      if (coordinates) setDeliveryCoords(coordinates);
                    }}
                    placeholder="Buscar dirección en Nicoya..."
                    nicoyaOnly={true}
                  />
                  <div className="mt-3">
                    <ZonePicker
                      value={deliveryInfo.zone}
                      onChange={(zone) => {
                        setZoneAuto(false);
                        setDeliveryInfo((prev) => ({ ...prev, zone }));
                      }}
                    />
                    {zoneAuto && deliveryInfo.zone && (
                      <p className="text-xs text-kiwi-700 dark:text-kiwi-300 mt-1.5">
                        📍 Barrio por tu ubicación (podés cambiarlo).
                      </p>
                    )}
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
                  {!cardAllowed && (
                    <p className="mb-3 rounded-xl bg-surface-100 dark:bg-surface-700/60 px-3 py-2 text-xs text-surface-500 dark:text-surface-400">
                      Este comercio cobra en efectivo. La tarjeta se habilita cuando complete su
                      verificación.
                    </p>
                  )}
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
                    ].map((method) => {
                      const enabled = isPayMethodEnabled(method.id);
                      const platformOn = !!(payAvailability as Record<string, boolean>)[method.id];
                      const offReason = !platformOn
                        ? 'No disponible'
                        : !enabled
                          ? 'No activado'
                          : null;
                      const selected = paymentMethod === method.id;
                      const MethodIcon = method.icon as any;
                      return (
                        <motion.button
                          key={method.id}
                          type="button"
                          disabled={!enabled}
                          aria-disabled={!enabled}
                          title={enabled ? method.label : `${method.label}: ${offReason}`}
                          aria-label={
                            enabled ? method.label : `${method.label} inactivo: ${offReason}`
                          }
                          className={`relative flex min-w-0 flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${
                            selected
                              ? 'bg-kiwi-100 dark:bg-kiwi-900/50 ring-2 ring-kiwi-600'
                              : enabled
                                ? 'bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600'
                                : 'bg-surface-100 dark:bg-surface-700/60 opacity-50 grayscale cursor-not-allowed'
                          }`}
                          onClick={() => {
                            if (enabled) setPaymentMethod(method.id);
                          }}
                          whileTap={enabled ? { scale: 0.95 } : undefined}
                        >
                          <span className="text-2xl">
                            {typeof method.icon === 'string' ? (
                              method.icon
                            ) : (
                              <MethodIcon className="h-6 w-6" />
                            )}
                          </span>
                          <span
                            className={`text-sm font-semibold leading-tight text-center ${
                              selected
                                ? 'text-kiwi-700 dark:text-kiwi-400'
                                : 'text-surface-700 dark:text-surface-300'
                            }`}
                          >
                            {method.label}
                          </span>
                          <span className="text-[11px] leading-tight text-center text-surface-500 dark:text-surface-400">
                            {method.desc}
                          </span>
                          {offReason && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface-200 dark:bg-surface-600 px-2 py-0.5 text-[10px] font-medium text-surface-500 dark:text-surface-400">
                              <Lock className="h-3 w-3" />
                              {offReason}
                            </span>
                          )}
                          {selected && (
                            <motion.div
                              className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-kiwi-700 text-white text-xs flex items-center justify-center"
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
                                ? 'bg-purple-100 dark:bg-purple-900/50 ring-2 ring-purple-500'
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
                      <label className="mt-2 block">
                        <span className="mb-1 block text-xs font-medium text-gold-700 dark:text-gold-400">
                          ¿Con cuánto pagás? (para llevarte el vuelto listo)
                        </span>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500">
                            ₡
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={cashTendered}
                            onChange={(e) => setCashTendered(e.target.value)}
                            placeholder={`Ej: ${totalWithDelivery.toLocaleString()}`}
                            className="w-full rounded-xl border border-gold-200 dark:border-gold-800 bg-white dark:bg-surface-900 pl-8 pr-4 py-2.5 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                          />
                        </div>
                      </label>
                      {cashTendered !== '' &&
                        Number(cashTendered) >= totalWithDelivery &&
                        Number(cashTendered) > totalWithDelivery && (
                          <p className="mt-1.5 text-xs font-semibold text-kiwi-700 dark:text-kiwi-300">
                            Vuelto: ₡{(Number(cashTendered) - totalWithDelivery).toLocaleString()}
                          </p>
                        )}
                      {cashTendered !== '' && Number(cashTendered) < totalWithDelivery && (
                        <p className="mt-1.5 text-xs font-semibold text-red-500">
                          El monto no cubre el total de ₡{totalWithDelivery.toLocaleString()}
                        </p>
                      )}
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
                    {serviceFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-surface-500 dark:text-surface-400">
                          Servicio Kiwi ({Math.round(servicePct * 100)}%)
                        </span>
                        <span className="text-surface-800 dark:text-surface-200">
                          ₡{serviceFee.toLocaleString()}
                        </span>
                      </div>
                    )}
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

                {!canCheckout && isPayMethodEnabled(paymentMethod) && (
                  <p className="text-xs text-center text-surface-400">
                    Completa nombre, dirección y teléfono para continuar
                  </p>
                )}
                {!isPayMethodEnabled(paymentMethod) && (
                  <p className="text-xs text-center font-medium text-red-500">
                    Este comercio no tiene métodos de pago activos: no se puede pedir ahora
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
