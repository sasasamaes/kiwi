'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Home,
  Package,
  CreditCard,
  Smartphone,
  DollarSign,
  Calendar,
  BarChart3,
  Clock,
  PartyPopper,
  Bike,
  Star,
} from 'lucide-react';
import {
  AnimatedButton,
  StaggerContainer,
  StaggerItem,
  useAuth,
  useSocket,
  api,
  MenuItem,
  calculateDistance,
  ShareTrackingButton,
} from '@kiwi/ui';

type Step = 1 | 2 | 3 | 4 | 5;

interface Driver {
  id: string;
  fullName: string;
  vehicleType?: string;
  rating?: number;
}

/**
 * Normaliza a perfil de repartidor: favoritos viene como
 * {id: favoriteId, driverId, driver: {...perfil}} mientras disponibles
 * viene como perfil directo. El id que vale para assign/favorite es
 * SIEMPRE el del perfil (DriverProfile.id).
 */
const toDriverList = (data: any): Driver[] => {
  const raw = Array.isArray(data) ? data : (data?.drivers ?? data?.favorites ?? data?.data ?? []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => {
      const p = item?.driver ?? item;
      if (!p?.id) return null;
      return {
        id: String(p.id),
        fullName: p.fullName ?? 'Repartidor',
        vehicleType: p.vehicleType,
        rating: typeof p.rating === 'number' ? p.rating : Number(p.rating) || undefined,
      } as Driver;
    })
    .filter(Boolean) as Driver[];
};

/** Backend pricing tiers (orders.service calculateBasePrice). */
const tripPriceForKm = (km: number): number => {
  if (km <= 1) return 800;
  if (km <= 2) return 1000;
  if (km <= 5) return 1500;
  if (km <= 10) return 2000;
  return Math.round(2000 + (km - 10) * 350);
};

// Misma zona plana del backend: ₡2000 en 10 km del parque de Nicoya.
const NICOYA_LAT = 10.1467;
const NICOYA_LNG = -85.452;
const NICOYA_ZONE_KM = 10;
const NICOYA_FLAT = 2000;

const inNicoyaZone = (lat?: number, lng?: number): boolean => {
  if (lat == null || lng == null) return false;
  const km = calculateDistance({ lat, lng }, { lat: NICOYA_LAT, lng: NICOYA_LNG });
  return Number.isFinite(km) && km <= NICOYA_ZONE_KM;
};

interface GeoSuggestion {
  displayName: string;
  shortName?: string;
  lat: number;
  lng: number;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  menuItemId?: string;
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
  kind: 'food' | 'freight';
  packageDescription: string;
  packageSize: '' | 'S' | 'M' | 'L';
  declaredValue: number;
  weightKg: number;
  specialInstructions: string;
  isScheduled: boolean;
  scheduledDate: string;
  scheduledTime: string;
  paymentMethod: 'cash' | 'sinpe' | 'card' | 'crypto';
}

interface SavedAddress {
  id: string;
  name: string;
  address: string;
  isDefault?: boolean;
}

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
    kind: 'food',
    packageDescription: '',
    packageSize: '',
    declaredValue: 0,
    weightKg: 0,
    specialInstructions: '',
    isScheduled: false,
    scheduledDate: '',
    scheduledTime: '',
    paymentMethod: 'sinpe',
  });

  const [newItem, setNewItem] = useState({ name: '', quantity: 1, price: 0 });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [quickCategory, setQuickCategory] = useState('Todos');
  const [favoriteDrivers, setFavoriteDrivers] = useState<Driver[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [driversLoading, setDriversLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pickupSuggest, setPickupSuggest] = useState<GeoSuggestion[]>([]);
  const [deliverySuggest, setDeliverySuggest] = useState<GeoSuggestion[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const pickupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliveryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direcciones guardadas reales: del perfil + la que esté en uso.
  const savedAddresses: SavedAddress[] = [
    ...(user?.merchantProfile?.address
      ? [
          {
            id: 'profile',
            name: user.merchantProfile.businessName || 'Mi Negocio',
            address: user.merchantProfile.address,
            isDefault: true as const,
          },
        ]
      : []),
    ...(orderData.pickupAddress && orderData.pickupAddress !== user?.merchantProfile?.address
      ? [
          {
            id: 'current',
            name: orderData.pickupName || 'Actual',
            address: orderData.pickupAddress,
          },
        ]
      : []),
  ];

  // El usuario carga async: rellenar pickup cuando llegue el perfil.
  const profileAddress = user?.merchantProfile?.address || '';
  const profileName = user?.merchantProfile?.businessName || '';
  useEffect(() => {
    if (!profileAddress) return;
    setOrderData((prev) =>
      prev.pickupAddress || prev.pickupName
        ? prev
        : { ...prev, pickupAddress: profileAddress, pickupName: profileName },
    );
  }, [profileAddress, profileName]);

  useEffect(() => {
    api
      .getMyMenuItems()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMenuItems(
          list
            .filter((item) => item.isAvailable !== false)
            .map((item) => ({
              ...item,
              price: Number(item.price),
            })),
        );
      })
      .catch(() => {
        setMenuItems([]);
      });
  }, []);

  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    const loadDrivers = async () => {
      setDriversLoading(true);
      try {
        const favs = await api.getFavoriteDrivers().catch(() => []);
        if (!cancelled) setFavoriteDrivers(toDriverList(favs));
      } catch {
        if (!cancelled) setFavoriteDrivers([]);
      }
      try {
        const avail = await api
          .getAvailableDrivers(orderData.pickupLat, orderData.pickupLng)
          .catch(() => []);
        if (!cancelled) setAvailableDrivers(toDriverList(avail));
      } catch {
        if (!cancelled) setAvailableDrivers([]);
      } finally {
        if (!cancelled) setDriversLoading(false);
      }
    };
    loadDrivers();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Distancia real: backend cuando hay coords, haversine local como
  // respaldo, null honesto cuando no hay con qué calcular.
  useEffect(() => {
    const { pickupLat, pickupLng, deliveryLat, deliveryLng } = orderData;
    if (pickupLat == null || pickupLng == null || deliveryLat == null || deliveryLng == null) {
      setRouteKm(null);
      return;
    }
    let cancelled = false;
    const fallbackKm = () => {
      try {
        const km = calculateDistance(
          { lat: pickupLat, lng: pickupLng },
          { lat: deliveryLat, lng: deliveryLng },
        );
        if (!cancelled)
          setRouteKm(Number.isFinite(km) && km >= 0 ? Math.round(km * 10) / 10 : null);
      } catch {
        if (!cancelled) setRouteKm(null);
      }
    };
    api
      .calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng)
      .then((res: any) => {
        const km = Number(res?.distanceKm ?? res?.km ?? res?.distance);
        if (cancelled) return;
        if (Number.isFinite(km) && km >= 0) setRouteKm(Math.round(km * 10) / 10);
        else fallbackKm();
      })
      .catch(fallbackKm);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderData.pickupLat, orderData.pickupLng, orderData.deliveryLat, orderData.deliveryLng]);

  const searchPlaces = async (q: string, target: 'pickup' | 'delivery') => {
    const query = q.trim();
    if (query.length < 3) {
      target === 'pickup' ? setPickupSuggest([]) : setDeliverySuggest([]);
      return;
    }
    try {
      const res = await api.searchNicoyaAddresses(query, 5);
      const list: GeoSuggestion[] = (Array.isArray(res) ? res : []).map((r: any) => ({
        displayName: r.displayName,
        shortName: r.shortName,
        lat: Number(r.lat),
        lng: Number(r.lng),
      }));
      target === 'pickup' ? setPickupSuggest(list) : setDeliverySuggest(list);
    } catch {
      target === 'pickup' ? setPickupSuggest([]) : setDeliverySuggest([]);
    }
  };

  const onPickupChange = (value: string) => {
    setOrderData((prev) => ({
      ...prev,
      pickupAddress: value,
      pickupLat: undefined,
      pickupLng: undefined,
    }));
    if (pickupDebounce.current) clearTimeout(pickupDebounce.current);
    pickupDebounce.current = setTimeout(() => searchPlaces(value, 'pickup'), 400);
  };

  const onDeliveryChange = (value: string) => {
    setOrderData((prev) => ({
      ...prev,
      deliveryAddress: value,
      deliveryLat: undefined,
      deliveryLng: undefined,
    }));
    if (deliveryDebounce.current) clearTimeout(deliveryDebounce.current);
    deliveryDebounce.current = setTimeout(() => searchPlaces(value, 'delivery'), 400);
  };

  const pickSuggestion = (s: GeoSuggestion, target: 'pickup' | 'delivery') => {
    if (target === 'pickup') {
      setOrderData((prev) => ({
        ...prev,
        pickupAddress: s.displayName,
        pickupLat: s.lat,
        pickupLng: s.lng,
      }));
      setPickupSuggest([]);
    } else {
      setOrderData((prev) => ({
        ...prev,
        deliveryAddress: s.displayName,
        deliveryLat: s.lat,
        deliveryLng: s.lng,
      }));
      setDeliverySuggest([]);
    }
  };

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('Tu navegador no soporta geolocalización');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const rev = await api.reverseGeocode(latitude, longitude);
          const label =
            rev?.displayName || rev?.shortName || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setOrderData((prev) => ({
            ...prev,
            pickupAddress: label,
            pickupLat: latitude,
            pickupLng: longitude,
          }));
        } catch {
          setOrderData((prev) => ({
            ...prev,
            pickupAddress: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            pickupLat: latitude,
            pickupLng: longitude,
          }));
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado'
            : 'No se pudo obtener tu ubicación',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const toggleFavorite = async (driver: Driver) => {
    const isFav = favoriteDrivers.some((d) => d.id === driver.id);
    try {
      if (isFav) {
        await api.removeFavoriteDriver(driver.id);
      } else {
        await api.addFavoriteDriver(driver.id);
      }
      const favs = await api.getFavoriteDrivers().catch(() => []);
      setFavoriteDrivers(toDriverList(favs));
    } catch (error) {
      console.error('Failed to update favorite:', error);
    }
  };

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

  const addQuickItem = (menuItem: MenuItem) => {
    const existingItem = orderData.items.find((i) => i.menuItemId === menuItem.id);
    if (existingItem) {
      setOrderData({
        ...orderData,
        items: orderData.items.map((i) =>
          i.id === existingItem.id ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      });
    } else {
      const item: OrderItem = {
        id: `quick-${menuItem.id}`,
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: 1,
        price: Number(menuItem.price),
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
  // Estimación con la misma regla del backend (el servidor recalcula al crear):
  // zona Nicoya = plano ₡2000, fuera = tabla por distancia. Sin coords se
  // asume Nicoya igual que el servidor.
  const inZone =
    orderData.deliveryLat != null
      ? inNicoyaZone(orderData.deliveryLat, orderData.deliveryLng)
      : orderData.pickupLat != null
        ? inNicoyaZone(orderData.pickupLat, orderData.pickupLng)
        : (routeKm ?? 0) <= NICOYA_ZONE_KM;
  const baseTrip = inZone ? NICOYA_FLAT : routeKm != null ? tripPriceForKm(routeKm) : NICOYA_FLAT;
  // Encomiendas por peso: los primeros 5 kg van incluidos; cada kg extra suma ₡500
  const weightSurchargeEstimate =
    orderData.kind === 'freight' && orderData.weightKg > 5
      ? Math.ceil(orderData.weightKg - 5) * 500
      : 0;
  const tripEstimate = baseTrip + weightSurchargeEstimate;
  const commissionEstimate = Math.round(tripEstimate * 0.1);
  const total = subtotal + tripEstimate + commissionEstimate;
  // ~25 km/h en moto dentro de Nicoya.
  const etaMin = routeKm != null ? Math.max(5, Math.round((routeKm / 25) * 60)) : null;

  const createOrderHandler = async () => {
    setFormError(null);
    if (orderData.isScheduled && !orderData.scheduledDate) {
      setFormError('Elegí fecha y hora para programar el pedido');
      return;
    }
    setLoading(true);
    try {
      // El backend es la fuente de verdad de los precios: re-lee el menú de la
      // BD y calcula productsTotal. Aquí solo enviamos los items con menuItemId.
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
        distanceKm: routeKm ?? undefined,
        kind: orderData.kind,
        items:
          orderData.kind === 'food'
            ? orderData.items.map((item) => ({
                menuItemId: item.menuItemId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                notes: item.notes || undefined,
              }))
            : [],
        packageDescription: orderData.kind === 'freight' ? orderData.packageDescription : undefined,
        packageSize:
          orderData.kind === 'freight' && orderData.packageSize !== ''
            ? orderData.packageSize
            : undefined,
        declaredValue:
          orderData.kind === 'freight' && orderData.declaredValue
            ? orderData.declaredValue
            : undefined,
        weightKg:
          orderData.kind === 'freight' && orderData.weightKg > 0 ? orderData.weightKg : undefined,
      });

      if (selectedDriverId) {
        await api.assignDriver(result.id, selectedDriverId);
      }

      // Cobro según método elegido (OnvoPay para sinpe/tarjeta, Stellar para crypto)
      try {
        if (orderData.paymentMethod === 'sinpe') {
          await api.createPayment({
            orderId: result.id,
            method: 'onvopay_sinpe',
            amount: total,
          });
        } else if (orderData.paymentMethod === 'card') {
          await api.createPayment({
            orderId: result.id,
            method: 'onvopay_card',
            amount: total,
          });
        } else if (orderData.paymentMethod === 'crypto') {
          await api.createPayment({
            orderId: result.id,
            method: 'crypto',
            amount: total,
            cryptoCoin: 'USDC',
          });
        } else {
          await api.createPayment({ orderId: result.id, method: 'cash', amount: total });
        }
      } catch (paymentError) {
        // El pedido ya existe: no lo tiramos a la basura por un fallo del cobro
        console.error('Failed to create payment:', paymentError);
      }

      setCreatedOrderId(result.id);
      setOrderCreated(true);

      // Emit socket event
      if (isConnected) {
        createOrder({
          orderId: result.id,
          pickupAddress: orderData.pickupAddress,
          deliveryAddress: orderData.deliveryAddress,
          totalAmount: total,
          distanceKm: routeKm ?? undefined,
        });
      }
    } catch (error: any) {
      console.error('Failed to create order:', error);
      setFormError(error?.message || 'Error al crear el pedido. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Recoger', icon: MapPin },
    { num: 2, label: 'Entregar', icon: Home },
    { num: 3, label: 'Detalles', icon: Package },
    { num: 4, label: 'Asignar', icon: Star },
    { num: 5, label: 'Pagar', icon: CreditCard },
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
            <PartyPopper className="h-24 w-24" />
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
                  {orderData.isScheduled ? (
                    <>
                      <Calendar className="h-4 w-4 inline" /> Programado
                    </>
                  ) : (
                    '⚡ Inmediato'
                  )}
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
                <BarChart3 className="h-4 w-4 inline" /> Volver al Dashboard
              </AnimatedButton>
            </Link>
            {createdOrderId && (
              <ShareTrackingButton
                orderId={createdOrderId}
                label="Copiar link para el cliente"
                className="w-full justify-center"
              />
            )}
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
          {steps.map((s, i) => {
            const StepIcon = s.icon as any;
            return (
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
                  {step > s.num ? '✓' : <StepIcon className="h-5 w-5" />}
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
            );
          })}
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
                <MapPin className="h-6 w-6 inline" /> ¿Dónde recoger?
              </h2>

              {/* Mode selector */}
              <div className="mb-4 grid grid-cols-2 gap-2">
                <motion.button
                  className={`rounded-xl p-4 text-left transition-all ${
                    orderData.kind === 'food'
                      ? 'border-2 border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30'
                      : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                  }`}
                  onClick={() =>
                    setOrderData({
                      ...orderData,
                      kind: 'food',
                      packageDescription: '',
                      packageSize: '',
                      declaredValue: 0,
                    })
                  }
                  whileTap={{ scale: 0.98 }}
                >
                  <p className="text-2xl">🍔</p>
                  <p className="font-medium text-surface-800 dark:text-surface-200">Comida</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">Pedido del menú</p>
                </motion.button>
                <motion.button
                  className={`rounded-xl p-4 text-left transition-all ${
                    orderData.kind === 'freight'
                      ? 'border-2 border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30'
                      : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                  }`}
                  onClick={() =>
                    setOrderData({
                      ...orderData,
                      kind: 'freight',
                      items: [],
                      weightKg: 0,
                    })
                  }
                  whileTap={{ scale: 0.98 }}
                >
                  <p className="text-2xl">📦</p>
                  <p className="font-medium text-surface-800 dark:text-surface-200">Encomienda</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    Paquete o mandado
                  </p>
                </motion.button>
              </div>

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
                    onChange={(e) => onPickupChange(e.target.value)}
                    placeholder="Ej: Nicoya Centro, 200m norte del parque"
                    rows={3}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                  />
                  {pickupSuggest.length > 0 && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-soft">
                      {pickupSuggest.map((s, i) => (
                        <button
                          key={`${s.lat}-${s.lng}-${i}`}
                          onClick={() => pickSuggestion(s, 'pickup')}
                          className="w-full text-left px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/20 transition-colors"
                        >
                          📍 {s.shortName || s.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <motion.button
                  className="rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4 cursor-pointer w-full text-left"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={useCurrentLocation}
                  disabled={locating}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      <MapPin className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-kiwi-700 dark:text-kiwi-400">
                        {locating ? 'Detectando ubicación…' : 'Usar ubicación actual'}
                      </p>
                      <p className="text-xs text-kiwi-600 dark:text-kiwi-500">
                        {locating ? 'Esperando al GPS…' : 'Detectar automáticamente'}
                      </p>
                    </div>
                  </div>
                </motion.button>
                {geoError && <p className="text-sm text-red-500 dark:text-red-400">{geoError}</p>}
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
                <Home className="h-6 w-6 inline" /> ¿Dónde entregar?
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
                    onChange={(e) => onDeliveryChange(e.target.value)}
                    placeholder="Ej: Santa Cruz, 500m sur del banco"
                    rows={3}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                  />
                  {deliverySuggest.length > 0 && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-soft">
                      {deliverySuggest.map((s, i) => (
                        <button
                          key={`${s.lat}-${s.lng}-${i}`}
                          onClick={() => pickSuggestion(s, 'delivery')}
                          className="w-full text-left px-4 py-2.5 text-sm text-surface-700 dark:text-surface-300 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/20 transition-colors"
                        >
                          📍 {s.shortName || s.displayName}
                        </button>
                      ))}
                    </div>
                  )}
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
                        {routeKm != null ? `~${routeKm} km` : 'Sin coords: se calcula al crear'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-surface-500 dark:text-surface-400">
                        Tiempo estimado
                      </span>
                      <span className="font-medium text-kiwi-600 dark:text-kiwi-400">
                        {etaMin != null ? `~${etaMin} min` : '—'}
                      </span>
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
                <Package className="h-6 w-6 inline" /> Detalles del pedido
              </h2>

              {/* Quick Add Section */}
              {orderData.kind === 'freight' ? (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                      Descripción del paquete *
                    </label>
                    <textarea
                      value={orderData.packageDescription}
                      onChange={(e) =>
                        setOrderData({ ...orderData, packageDescription: e.target.value })
                      }
                      placeholder="Ej: Caja con repuestos"
                      rows={3}
                      className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                      Tamaño del paquete
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['S', 'M', 'L'] as const).map((size) => (
                        <motion.button
                          key={size}
                          className={`rounded-xl p-3 text-center font-medium transition-all ${
                            orderData.packageSize === size
                              ? 'border-2 border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30 text-surface-800 dark:text-surface-200'
                              : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                          }`}
                          onClick={() => setOrderData({ ...orderData, packageSize: size })}
                          whileTap={{ scale: 0.95 }}
                        >
                          {size}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                      Peso del paquete (kg)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={orderData.weightKg || ''}
                        onChange={(e) =>
                          setOrderData({
                            ...orderData,
                            weightKg: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="Ej: 12"
                        className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                      />
                      <span className="text-sm text-surface-500 dark:text-surface-400">kg</span>
                    </div>
                    <p className="mt-1 text-xs text-surface-400 dark:text-surface-500">
                      Los primeros 5 kg van incluidos en el envío · cada kg extra suma ₡500
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                      Valor declarado (opcional)
                    </label>
                    <input
                      type="number"
                      value={orderData.declaredValue || ''}
                      onChange={(e) =>
                        setOrderData({
                          ...orderData,
                          declaredValue: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="₡"
                      className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                    />
                  </div>
                </div>
              ) : (
                <>
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
                          className="mt-2"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          {menuItems.length === 0 ? (
                            <div className="rounded-xl bg-surface-50 dark:bg-surface-800 p-4 text-center">
                              <p className="text-sm text-surface-500 dark:text-surface-400">
                                Tu menú está vacío. Configúralo en{' '}
                                <Link
                                  href="/menu"
                                  className="font-medium text-kiwi-600 dark:text-kiwi-400 underline"
                                >
                                  Mi Menú
                                </Link>
                              </p>
                            </div>
                          ) : (
                            <>
                              {/* Encomienda por peso: acceso directo */}
                              <button
                                onClick={() =>
                                  setOrderData({
                                    ...orderData,
                                    kind: 'freight',
                                    items: [],
                                    weightKg: 0,
                                  })
                                }
                                className="mb-2 flex w-full items-center justify-between rounded-xl border border-dashed border-kiwi-300 dark:border-kiwi-700 bg-kiwi-50/50 dark:bg-kiwi-900/20 p-3 text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">📦</span>
                                  <div>
                                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                                      Encomienda / Flete por peso
                                    </p>
                                    <p className="text-xs text-surface-500 dark:text-surface-400">
                                      ₡2000 base (5 kg incluidos) + ₡500 por kg extra
                                    </p>
                                  </div>
                                </div>
                                <span className="text-kiwi-500">→</span>
                              </button>

                              {/* Categorías del menú */}
                              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                                {['Todos', ...new Set(menuItems.map((i) => i.category))].map(
                                  (cat) => (
                                    <button
                                      key={cat}
                                      onClick={() => setQuickCategory(cat)}
                                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                        quickCategory === cat
                                          ? 'bg-kiwi-500 text-white'
                                          : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                                      }`}
                                    >
                                      {cat}
                                    </button>
                                  ),
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {menuItems
                                  .filter(
                                    (item) =>
                                      quickCategory === 'Todos' || item.category === quickCategory,
                                  )
                                  .map((menuItem) => (
                                    <motion.button
                                      key={menuItem.id}
                                      className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-kiwi-300 dark:hover:border-kiwi-600 transition-colors"
                                      onClick={() => addQuickItem(menuItem)}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      {menuItem.image && menuItem.image !== 'Utensils' && (
                                        <span className="text-lg">{menuItem.image}</span>
                                      )}
                                      <div className="text-left min-w-0">
                                        <p className="text-xs font-medium text-surface-700 dark:text-surface-300 truncate">
                                          {menuItem.name}
                                        </p>
                                        <p className="text-xs text-kiwi-600 dark:text-kiwi-400">
                                          ₡{Number(menuItem.price).toLocaleString()}
                                        </p>
                                      </div>
                                    </motion.button>
                                  ))}
                              </div>
                            </>
                          )}
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
                              setNewItem({
                                ...newItem,
                                quantity: Math.max(1, newItem.quantity - 1),
                              })
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
                            onClick={() =>
                              setNewItem({ ...newItem, quantity: newItem.quantity + 1 })
                            }
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
                        <span className="text-4xl">
                          <Package className="h-10 w-10" />
                        </span>
                        <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">
                          Agrega productos al pedido
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

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
                      <Calendar className="h-5 w-5 inline" /> Programar para después
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
                          min={new Date().toISOString().split('T')[0]}
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

          {/* Step 4: Assign Driver */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800 dark:text-surface-100">
                <Star className="h-6 w-6 inline" /> Asignar repartidor
              </h2>

              {/* Asignar después (default selected) */}
              <motion.div
                className={`rounded-xl border-2 p-4 mb-4 cursor-pointer transition-all ${
                  selectedDriverId === null
                    ? 'border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30'
                    : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                }`}
                onClick={() => setSelectedDriverId(null)}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⏳</span>
                    <div>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        Asignar después
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        Dejar para después en la página de conductores
                      </p>
                    </div>
                  </div>
                  {selectedDriverId === null && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-6 w-6 rounded-full bg-kiwi-500 flex items-center justify-center"
                    >
                      <span className="text-white text-xs">✓</span>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Favoritos */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-400">
                  ⭐ Favoritos
                </h3>
                {driversLoading ? (
                  <p className="text-sm text-surface-400">Cargando...</p>
                ) : favoriteDrivers.length === 0 ? (
                  <p className="text-sm text-surface-400">
                    No tienes conductores favoritos. Agrega algunos desde la página de conductores.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {favoriteDrivers.map((driver) => (
                      <motion.div
                        key={driver.id}
                        className={`flex items-center justify-between rounded-xl p-4 cursor-pointer transition-all ${
                          selectedDriverId === driver.id
                            ? 'border-2 border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30'
                            : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                        }`}
                        onClick={() =>
                          setSelectedDriverId(selectedDriverId === driver.id ? null : driver.id)
                        }
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {driver.vehicleType === 'bike'
                              ? '🚴'
                              : driver.vehicleType === 'car'
                                ? '🚗'
                                : '🏍️'}
                          </span>
                          <div>
                            <p className="font-medium text-surface-800 dark:text-surface-200">
                              {driver.fullName}
                            </p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">
                              {driver.vehicleType} • ⭐ {driver.rating}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(driver);
                          }}
                          className="text-surface-400 hover:text-kiwi-500 transition-colors"
                        >
                          <Star
                            className={`h-5 w-5 ${
                              favoriteDrivers.some((d) => d.id === driver.id)
                                ? 'fill-kiwi-500 text-kiwi-500'
                                : ''
                            }`}
                          />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Disponibles */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-400">
                  📍 Disponibles cerca de ti
                </h3>
                {driversLoading ? (
                  <p className="text-sm text-surface-400">Cargando...</p>
                ) : availableDrivers.length === 0 ? (
                  <p className="text-sm text-surface-400">
                    No hay conductores disponibles en este momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableDrivers.map((driver) => (
                      <motion.div
                        key={driver.id}
                        className={`flex items-center justify-between rounded-xl p-4 cursor-pointer transition-all ${
                          selectedDriverId === driver.id
                            ? 'border-2 border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30'
                            : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                        }`}
                        onClick={() =>
                          setSelectedDriverId(selectedDriverId === driver.id ? null : driver.id)
                        }
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {driver.vehicleType === 'bike'
                              ? '🚴'
                              : driver.vehicleType === 'car'
                                ? '🚗'
                                : '🏍️'}
                          </span>
                          <div>
                            <p className="font-medium text-surface-800 dark:text-surface-200">
                              {driver.fullName}
                            </p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">
                              {driver.vehicleType} • ⭐ {driver.rating}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(driver);
                          }}
                          className="text-surface-400 hover:text-kiwi-500 transition-colors"
                        >
                          <Star
                            className={`h-5 w-5 ${
                              favoriteDrivers.some((d) => d.id === driver.id)
                                ? 'fill-kiwi-500 text-kiwi-500'
                                : ''
                            }`}
                          />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 5: Payment & Review */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <h2 className="mb-6 text-xl font-display font-semibold text-surface-800 dark:text-surface-100">
                <CreditCard className="h-6 w-6 inline" /> Resumen y pago
              </h2>

              {/* Order Summary */}
              <div className="mb-6 rounded-xl glass p-4">
                <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-400">
                  Resumen del pedido
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">
                      <MapPin className="h-4 w-4 inline" /> Recoger:
                    </span>
                    <span className="font-medium text-surface-800 dark:text-surface-200 text-right max-w-[60%]">
                      {orderData.pickupName || 'No especificado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">
                      <Home className="h-4 w-4 inline" /> Entregar:
                    </span>
                    <span className="font-medium text-surface-800 dark:text-surface-200 text-right max-w-[60%]">
                      {orderData.deliveryName || 'No especificado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">
                      <Package className="h-4 w-4 inline" /> Productos:
                    </span>
                    <span className="font-medium text-surface-800 dark:text-surface-200">
                      {orderData.items.length} items (
                      {orderData.items.reduce((sum, i) => sum + i.quantity, 0)} uds)
                    </span>
                  </div>
                  {orderData.isScheduled && (
                    <div className="flex justify-between">
                      <span className="text-surface-500 dark:text-surface-400">
                        <Calendar className="h-4 w-4 inline" /> Programado:
                      </span>
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
                    <span className="text-surface-500 dark:text-surface-400">Productos</span>
                    <span className="text-surface-800 dark:text-surface-200">
                      ₡{subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">
                      Envío (para el repartidor)
                    </span>
                    <span className="text-kiwi-600 dark:text-kiwi-400 font-medium">
                      ₡{tripEstimate.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">
                      Comisión Kiwi (10% del envío)
                    </span>
                    <span className="text-surface-600 dark:text-surface-400">
                      ₡{commissionEstimate.toLocaleString()}
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
                      icon: Smartphone,
                      label: 'SINPE Móvil',
                      desc: 'Transferencia instantánea (OnvoPay)',
                    },
                    {
                      id: 'card',
                      icon: CreditCard,
                      label: 'Tarjeta',
                      desc: 'Crédito o débito (OnvoPay)',
                    },
                    {
                      id: 'crypto',
                      icon: '₿',
                      label: 'Cripto (USDC)',
                      desc: 'Pago digital vía Stellar',
                    },
                    {
                      id: 'cash',
                      icon: DollarSign,
                      label: 'Efectivo',
                      desc: 'Pagar al repartidor',
                    },
                  ].map((method) => {
                    const PaymentIcon = method.icon as any;
                    return (
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
                          <span className="text-2xl">
                            {typeof PaymentIcon === 'string' ? (
                              PaymentIcon
                            ) : (
                              <PaymentIcon className="h-6 w-6" />
                            )}
                          </span>
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
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Actions */}
      <div className="sticky bottom-0 border-t border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl p-4">
        <div className="mx-auto max-w-lg">
          {formError && (
            <div className="mb-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}
        </div>
        <div className="mx-auto max-w-lg flex gap-3">
          {step > 1 && (
            <AnimatedButton
              variant="secondary"
              onClick={() => {
                setFormError(null);
                setStep((step - 1) as Step);
              }}
              className="flex-1 dark:bg-surface-800 dark:text-surface-300"
            >
              ← Atrás
            </AnimatedButton>
          )}

          {step < 5 ? (
            <AnimatedButton
              variant="gradient"
              onClick={() => {
                if (step === 3 && orderData.isScheduled && !orderData.scheduledDate) {
                  setFormError('Elegí fecha y hora para programar el pedido');
                  return;
                }
                setFormError(null);
                setStep((step + 1) as Step);
              }}
              className="flex-1"
              disabled={
                (step === 1 && !orderData.pickupAddress) ||
                (step === 2 && !orderData.deliveryAddress) ||
                (step === 3 && orderData.kind === 'food' && orderData.items.length === 0) ||
                (step === 3 && orderData.kind === 'freight' && !orderData.packageDescription.trim())
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
                    <Clock className="h-5 w-5" />
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
