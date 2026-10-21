// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Package } from 'lucide-react';
import {
  AnimatedButton,
  useAuth,
  useSocket,
  api,
  MenuItem,
  calculateDistance,
  ShareTrackingButton,
  ZonePicker,
  DeliveryZonesMap,
  useDeliveryZones,
  safeNavigateToUrl,
  parseMapLink,
  useTranslations,
} from '@kiwi/ui';
import { findDeliveryZone, detectDeliveryZoneFromText, findNearestZone } from '@kiwi/types';
import { Driver, toDriverList } from '../../drivers/mappers';

type Step = 1 | 2 | 3;

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  menuItemId?: string;
}

/** Misma zona plana del backend: ₡2000 en 10 km del parque de Nicoya. */
const NICOYA_LAT = 10.1467;
const NICOYA_LNG = -85.452;
const NICOYA_ZONE_KM = 10;
const NICOYA_FLAT = 2000;

const tripPriceForKm = (km: number): number => {
  if (km <= 1) return 800;
  if (km <= 2) return 1000;
  if (km <= 5) return 1500;
  if (km <= 10) return 2000;
  return Math.round(2000 + (km - 10) * 350);
};

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

function NewOrderInner({
  presetKind,
  isPreset = false,
  presetDriverId = null,
  presetDriverName = null,
}: {
  presetKind: 'food' | 'freight';
  isPreset?: boolean;
  presetDriverId?: string | null;
  presetDriverName?: string | null;
}) {
  const router = useRouter();
  const { t } = useTranslations();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  // Anti-duplicados: el comercio con wifi caído le daba varias veces a
  // "Crear Pedido" y cada tap creaba un pedido distinto (7x Cinthya).
  // - creatingRef bloquea el doble-tap mientras hay un POST en vuelo.
  // - idempotencyKeyRef se genera una vez por intento y se reutiliza en
  //   todos los reintentos: el backend devuelve el mismo pedido si la key
  //   ya existe en vez de crear otro. Solo se regenera al lograrlo.
  const creatingRef = useRef(false);
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
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // El pedido puede existir sin pago (falló el cobro): se muestra reintento
  // en vez de un éxito limpio que esconde la deuda.
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);
  // % que Kiwi descuenta del payout del repartidor (el comercio NO lo paga:
  // paga productos + viaje de la zona). Solo espejo visual: el backend manda.
  const [tripPct, setTripPct] = useState(0.15);
  useEffect(() => {
    api
      .getPlatformFees()
      .then((f) => setTripPct((Number(f?.standardPct) || 15) / 100))
      .catch(() => undefined);
  }, []);

  const [kind, setKind] = useState<'food' | 'freight'>(presetKind);
  // Si el tipo llega preseleccionado por la URL y la URL cambia (nav entre los
  // botones del dashboard sin remount), síncrono con el nuevo preset.
  useEffect(() => {
    setKind(presetKind);
  }, [presetKind]);
  // Selector oculto cuando el tipo ya se eligió al entrar; "Cambiar" lo trae de vuelta.
  const [showKindSelector, setShowKindSelector] = useState(!isPreset);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuQuery, setMenuQuery] = useState('');
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, price: 0 });

  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryZone, setDeliveryZone] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | undefined>(undefined);
  const [deliveryLng, setDeliveryLng] = useState<number | undefined>(undefined);
  const [pickupAddress, setPickupAddress] = useState(user?.merchantProfile?.address || '');
  const [mapLink, setMapLink] = useState('');
  const [mapLinkMsg, setMapLinkMsg] = useState<string | null>(null);
  const [deliverySuggest, setDeliverySuggest] = useState<GeoSuggestion[]>([]);
  const [locating, setLocating] = useState(false);
  const [showZonesMap, setShowZonesMap] = useState(false);

  const [packageDescription, setPackageDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'sinpe' | 'card' | 'crypto' | 'credit'
  >('sinpe');
  // Crédito prepago: solo cubre el viaje. Se descuenta al crear.
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  // Efectivo: con cuánto pagan (para que el repartidor lleve el vuelto listo).
  const [cashTendered, setCashTendered] = useState('');
  // % de comisión del repartidor (admin). Solo espejo visual: el backend manda.
  const [commissionPct, setCommissionPct] = useState(15);

  // Métodos habilitados por el admin (/admin/settings). Crédito siempre va.
  const [payAvailability, setPayAvailability] = useState({
    sinpe: true,
    card: true,
    cash: true,
    crypto: true,
  });

  useEffect(() => {
    api
      .getCreditBalance()
      .then((r) => setCreditBalance(Number(r?.balance ?? 0)))
      .catch(() => setCreditBalance(null));
    api
      .getDriverCommissionPct()
      .then((p) => setCommissionPct(p))
      .catch(() => undefined);
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
        // Si el método elegido quedó deshabilitado, caer al primero válido
        setPaymentMethod((prev) => {
          const enabled: string[] = (Object.entries(next) as [string, boolean][])
            .filter(([, on]) => on)
            .map(([k]) => k);
          if (prev === 'credit' || enabled.includes(prev)) return prev;
          return ((enabled[0] as any) ?? 'credit') as typeof prev;
        });
      })
      .catch(() => undefined);
  }, []);

  const [favoriteDrivers, setFavoriteDrivers] = useState<Driver[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(presetDriverId);
  const [driversLoading, setDriversLoading] = useState(false);
  // Aviso cuando el repartidor preset ya no está disponible (se desmarca).
  const [driverPresetNote, setDriverPresetNote] = useState<string | null>(null);
  const presetValidated = useRef(false);

  const [routeKm, setRouteKm] = useState<number | null>(null);
  const deliveryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  // El timer del buscador no debe dispararse tras desmontar.
  useEffect(() => {
    return () => {
      if (deliveryDebounce.current) clearTimeout(deliveryDebounce.current);
    };
  }, []);

  const profileAddress = user?.merchantProfile?.address || '';
  useEffect(() => {
    if (profileAddress) {
      setPickupAddress((prev) => prev || profileAddress);
    }
  }, [profileAddress]);

  useEffect(() => {
    api
      .getMyMenuItems()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setMenuItems(
          list
            .filter((item) => item.isAvailable !== false)
            .map((item) => ({ ...item, price: Number(item.price) })),
        );
      })
      .catch(() => setMenuItems([]));
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    const load = async () => {
      setDriversLoading(true);
      try {
        const [favs, avail] = await Promise.all([
          api.getFavoriteDrivers().catch(() => []),
          api.getAvailableDrivers().catch(() => []),
        ]);
        if (!cancelled) {
          const favList = toDriverList(favs);
          const availList = toDriverList(avail);
          setFavoriteDrivers(favList);
          setAvailableDrivers(availList);
          // Preset de Repartidores: solo vale si sigue disponible; si no,
          // se desmarca con aviso en vez de dejar un pedido que el backend
          // rechazaría al crear.
          if (presetDriverId && !presetValidated.current) {
            presetValidated.current = true;
            const found = [...favList, ...availList].find((d) => d.id === presetDriverId);
            if (!found || found.status !== 'available') {
              setSelectedDriverId(null);
              setDriverPresetNote(
                t('webshop2.neworder.presetGone', {
                  name: presetDriverName || t('webshop2.neworder.driverFallback'),
                }),
              );
            }
          }
        }
      } finally {
        if (!cancelled) setDriversLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [step]);

  // Distancia real con las coords de entrega (pickup = comercio).
  useEffect(() => {
    if (deliveryLat == null || deliveryLng == null) {
      setRouteKm(null);
      return;
    }
    let cancelled = false;
    const origin = { lat: NICOYA_LAT, lng: NICOYA_LNG };
    api
      .calculateDistance(origin.lat, origin.lng, deliveryLat, deliveryLng)
      .then((res: any) => {
        const km = Number(res?.distanceKm ?? res?.km ?? res?.distance);
        if (!cancelled) {
          if (Number.isFinite(km) && km >= 0) setRouteKm(Math.round(km * 10) / 10);
          else throw new Error('bad');
        }
      })
      .catch(() => {
        if (cancelled) return;
        try {
          const km = calculateDistance(origin, { lat: deliveryLat!, lng: deliveryLng! });
          setRouteKm(Number.isFinite(km) ? Math.round(km * 10) / 10 : null);
        } catch {
          setRouteKm(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryLat, deliveryLng]);

  const searchPlaces = async (q: string) => {
    if (q.trim().length < 3) {
      setDeliverySuggest([]);
      return;
    }
    // Si el texto ya nombra un barrio ("Matabuey, 100m este…") y aún no hay
    // zona elegida, preseleccionarla. Nunca pisa una elección manual previa.
    const typedZone = detectDeliveryZoneFromText(q);
    if (typedZone) setDeliveryZone((prev) => prev || typedZone.id);
    const seq = (searchSeq.current += 1);
    try {
      const res = await api.searchNicoyaAddresses(q.trim(), 5);
      // Respuesta vieja (el usuario siguió escribiendo): descartar.
      if (seq !== searchSeq.current) return;
      setDeliverySuggest(
        (Array.isArray(res) ? res : []).map((r: any) => ({
          displayName: r.displayName,
          shortName: r.shortName,
          lat: Number(r.lat),
          lng: Number(r.lng),
        })),
      );
    } catch {
      if (seq !== searchSeq.current) return;
      setDeliverySuggest([]);
    }
  };

  const onDeliveryChange = (value: string) => {
    setDeliveryAddress(value);
    setDeliveryLat(undefined);
    setDeliveryLng(undefined);
    if (deliveryDebounce.current) clearTimeout(deliveryDebounce.current);
    deliveryDebounce.current = setTimeout(() => searchPlaces(value), 700);
  };

  const pickSuggestion = (s: GeoSuggestion) => {
    setDeliveryAddress(s.displayName);
    setDeliveryLat(s.lat);
    setDeliveryLng(s.lng);
    setDeliverySuggest([]);
    void autoDetectZone(s.lat, s.lng, s.displayName);
  };

  /**
   * GPS → zona → tarifa (referencia). Orden:
   * 1) texto explícito (dirección escrita o label del link),
   * 2) punto de referencia más cercano — SOLO si es claro (confident),
   * 3) reverse-geocode + match por texto.
   * Cerca de un límite (confident=false) NO se fija nada: se muestran las
   * candidatas y el comercio confirma en la lista o el mapa.
   */
  const autoDetectZone = async (lat: number, lng: number, fixedLabel: string) => {
    const base = t('webshop2.neworder.zoneSet', { label: fixedLabel });
    const apply = (zoneId: string, zoneLabel: string, zonePrice: number, note: string) => {
      setDeliveryZone(zoneId);
      setMapLinkMsg(
        `${base} · ${t('webshop2.neworder.zoneIs', { label: zoneLabel, price: zonePrice.toLocaleString() })} ${note}`,
      );
    };
    const direct = detectDeliveryZoneFromText(fixedLabel, deliveryAddress);
    if (direct) {
      apply(direct.id, direct.label, direct.price, t('webshop2.neworder.zoneByName'));
      return;
    }
    const near = findNearestZone(lat, lng);
    if (near?.confident) {
      apply(near.zone.id, near.zone.label, near.zone.price, t('webshop2.neworder.zoneByNear'));
      return;
    }
    const candidatesMsg =
      near?.runnerUp != null
        ? t('webshop2.neworder.zoneBetween', {
            a: near.zone.label,
            pa: near.zone.price.toLocaleString(),
            b: near.runnerUp.zone.label,
            pb: near.runnerUp.zone.price.toLocaleString(),
          })
        : t('webshop2.neworder.zoneManual');
    try {
      const rev: any = await api.reverseGeocode(lat, lng);
      const addr = rev?.address ?? {};
      const zone = detectDeliveryZoneFromText(
        addr.neighbourhood,
        addr.suburb,
        addr.road,
        addr.village,
        addr.hamlet,
        addr.town,
        addr.city,
        rev?.displayName,
        rev?.shortName,
      );
      if (zone) {
        apply(zone.id, zone.label, zone.price, t('webshop2.neworder.zoneByAddr'));
      } else {
        setMapLinkMsg(`${base}. ${candidatesMsg}`);
      }
    } catch {
      setMapLinkMsg(`${base}. ${candidatesMsg}`);
    }
  };

  const applyMapLink = async () => {
    setMapLinkMsg(null);
    const parsed = parseMapLink(mapLink);
    if (!parsed) {
      // El parser local no entendió el link: intentar resolver vía backend
      // (cubre acortados pegados con texto extra y formatos raros).
      setMapLinkMsg(t('webshop2.neworder.linkOpening'));
      try {
        const r: any = await api.resolveMapLink(mapLink);
        if (r && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng))) {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          const label = r.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setDeliveryLat(lat);
          setDeliveryLng(lng);
          setDeliveryAddress((prev) => prev || label);
          setDeliverySuggest([]);
          setMapLink('');
          await autoDetectZone(lat, lng, label);
          return;
        }
      } catch {
        // cae al mensaje de ayuda
      }
      setMapLinkMsg(t('webshop2.neworder.linkPasteHint'));
      return;
    }
    if (parsed.kind === 'short') {
      setMapLinkMsg(t('webshop2.neworder.linkOpeningShort'));
      try {
        const r: any = await api.resolveMapLink(mapLink);
        if (r && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng))) {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          const label = r.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setDeliveryLat(lat);
          setDeliveryLng(lng);
          setDeliveryAddress((prev) => prev || label);
          setDeliverySuggest([]);
          setMapLink('');
          await autoDetectZone(lat, lng, label);
          return;
        }
        setMapLinkMsg(r?.error || t('webshop2.neworder.linkShortFailed'));
      } catch {
        setMapLinkMsg(t('webshop2.neworder.linkShortFailed'));
      }
      return;
    }
    if (parsed.kind === 'coords') {
      setDeliveryLat(parsed.point.lat);
      setDeliveryLng(parsed.point.lng);
      setDeliveryAddress((prev) => prev || parsed.point.label);
      setDeliverySuggest([]);
      setMapLink('');
      await autoDetectZone(parsed.point.lat, parsed.point.lng, parsed.point.label);
      return;
    }
    // query de texto: buscar y tomar el primer resultado
    try {
      const res = await api.searchNicoyaAddresses(parsed.query, 1);
      const first = Array.isArray(res) ? res[0] : null;
      if (first) {
        setDeliveryLat(Number(first.lat));
        setDeliveryLng(Number(first.lng));
        setDeliveryAddress(first.displayName);
        setMapLink('');
        await autoDetectZone(Number(first.lat), Number(first.lng), first.displayName);
      } else {
        setMapLinkMsg(t('webshop2.neworder.linkNotFound'));
      }
    } catch {
      setMapLinkMsg(t('webshop2.neworder.linkResolveFailed'));
    }
  };

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let name = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
          const rev = await api.reverseGeocode(latitude, longitude);
          name = rev?.displayName || name;
          setDeliveryAddress(name);
        } catch {
          setDeliveryAddress(name);
        } finally {
          setDeliveryLat(latitude);
          setDeliveryLng(longitude);
          setLocating(false);
        }
        await autoDetectZone(latitude, longitude, name);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // ---- Items ----
  const addCustomItem = () => {
    if (!newItem.name.trim() || newItem.price <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 9),
        name: newItem.name.trim(),
        quantity: Math.max(1, newItem.quantity),
        price: newItem.price,
      },
    ]);
    setNewItem({ name: '', quantity: 1, price: 0 });
  };

  const bumpItem = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0),
    );
  };

  // ---- Precio espejo del backend ----
  // La fuente es la tabla de zonas del admin (DB, vía useDeliveryZones); el
  // catálogo en código es solo fallback. El servidor revalida y cobra.
  // Sin barrio, fallback a la lógica anterior por distancia.
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const dbZones = useDeliveryZones();
  const dbZone = dbZones.find((z) => z.id === deliveryZone) ?? null;
  const zonePrice = dbZone?.price ?? findDeliveryZone(deliveryZone)?.price ?? null;
  const inZone =
    deliveryLat != null ? inNicoyaZone(deliveryLat, deliveryLng) : (routeKm ?? 0) <= NICOYA_ZONE_KM;
  const baseTrip =
    zonePrice ?? (inZone ? NICOYA_FLAT : routeKm != null ? tripPriceForKm(routeKm) : NICOYA_FLAT);
  const zoneLabel = dbZone?.label ?? findDeliveryZone(deliveryZone)?.label ?? null;
  const trip = baseTrip;
  // El comercio paga productos + viaje, SIN recargo: el 15% lo paga el
  // repartidor (payout = viaje − 15%). Igual que el backend.
  const driverPayout = trip - Math.round(trip * tripPct);
  const total = subtotal + trip;
  const etaMin = routeKm != null ? Math.max(5, Math.round((routeKm / 25) * 60)) : null;

  // Encomienda: la descripción es opcional — solo pide los datos de entrega.
  const step1Valid =
    (kind === 'food' ? items.length > 0 : true) &&
    deliveryName.trim().length > 0 &&
    deliveryPhone.trim().length >= 8 &&
    deliveryAddress.trim().length > 0 &&
    deliveryZone.trim().length > 0;

  // El botón deshabilitado no explica nada: decir qué falta.
  // Las notas son opcionales y por eso no aparecen aquí.
  const step1Missing: string[] = [];
  if (kind === 'food' && items.length === 0) {
    step1Missing.push(t('webshop2.neworder.missItems'));
  }
  if (deliveryName.trim().length === 0) step1Missing.push(t('webshop2.neworder.missName'));
  if (deliveryPhone.trim().length < 8) step1Missing.push(t('webshop2.neworder.missPhone'));
  if (deliveryAddress.trim().length === 0) step1Missing.push(t('webshop2.neworder.missAddress'));
  if (deliveryZone.trim().length === 0) step1Missing.push(t('webshop2.neworder.missZone'));

  const toggleFavorite = async (driver: Driver) => {
    const isFav = favoriteDrivers.some((d) => d.id === driver.id);
    const prev = favoriteDrivers;
    setFavoriteDrivers(isFav ? prev.filter((d) => d.id !== driver.id) : [...prev, driver]);
    try {
      if (isFav) await api.removeFavoriteDriver(driver.id);
      else await api.addFavoriteDriver(driver.id);
    } catch {
      setFavoriteDrivers(prev);
      setFormError(t('webshop2.neworder.errFav'));
    }
  };

  // Cobra el pedido ya creado. Para tarjeta/SINPE redirige al Checkout de
  // Onvo y devuelve redirected=true (la página se va; al volver, tracking
  // verifica el pago). Si no hay URL, lanza para mostrar reintento.
  const payForOrder = async (
    orderId: string,
    method: typeof paymentMethod,
  ): Promise<{ redirected: boolean }> => {
    if (method === 'sinpe' || method === 'card') {
      const res = await api.createPayment({
        orderId,
        method: method === 'sinpe' ? 'onvopay_sinpe' : 'onvopay_card',
        amount: total,
      });
      if (res?.checkoutUrl) {
        if (!safeNavigateToUrl(res.checkoutUrl)) {
          throw new Error(t('webshop2.neworder.errPayUrl'));
        }
        return { redirected: true };
      }
      throw new Error(t('webshop2.neworder.errNoPayLink'));
    }
    if (method === 'crypto') {
      await api.createPayment({ orderId, method: 'crypto', amount: total, cryptoCoin: 'USDC' });
      return { redirected: false };
    }
    if (method === 'credit') {
      // Solo el viaje (sin comisión): el backend lo valida y descuenta.
      await api.createPayment({ orderId, method: 'credit', amount: trip });
      return { redirected: false };
    }
    await api.createPayment({ orderId, method: 'cash', amount: total });
    return { redirected: false };
  };

  const retryPayment = async () => {
    if (!createdOrderId) return;
    setLoading(true);
    setPayError(null);
    try {
      await payForOrder(createdOrderId, paymentMethod);
      setPaymentFailed(false);
      if (paymentMethod === 'credit') {
        try {
          const r = await api.getCreditBalance();
          setCreditBalance(Number(r?.balance ?? 0));
        } catch {
          // noop
        }
      }
    } catch (err: any) {
      setPayError(err?.message || t('webshop2.neworder.errPayGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const createOrderHandler = async () => {
    // Doble-tap con wifi caído = N pedidos iguales. Si ya hay un POST en
    // vuelo, el segundo tap se ignora en vez de crear otro pedido.
    if (creatingRef.current) return;
    creatingRef.current = true;
    setFormError(null);
    setPayError(null);
    setPaymentFailed(false);
    setOrderNotice(null);
    if (!deliveryZone) {
      creatingRef.current = false;
      setFormError(t('webshop2.neworder.errZoneRequired'));
      return;
    }
    // El id elegido puede venir viejo (UUID de zona borrada/renombrada en el
    // admin): re-resolver contra la lista fresca y mandar el UUID vigente.
    // Si no matchea nada se manda tal cual y el backend decide (con mensaje
    // diagnóstico). Misma normalización que el servidor.
    const normZone = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    let zoneForServer = deliveryZone;
    try {
      const fresh = await api.getDeliveryZones().catch(() => []);
      if (Array.isArray(fresh)) {
        const hit =
          fresh.find((z: any) => z.id === deliveryZone) ??
          fresh.find((z: any) => normZone(String(z.label ?? '')) === normZone(deliveryZone));
        if (hit) {
          zoneForServer = hit.id;
          if (hit.id !== deliveryZone) setDeliveryZone(hit.id);
        }
      }
    } catch {
      // Sin red no se puede revalidar: se manda tal cual y el backend decide.
    }
    // Las coords pueden venir de un link/GPS erróneo: el precio de zona lo
    // enmascara en pantalla y el backend recién lo rechaza al crear.
    if (routeKm != null && routeKm > 300) {
      creatingRef.current = false;
      setFormError(t('webshop2.neworder.errTooFar', { km: routeKm }));
      return;
    }
    // Saldo fresco (el del mount puede estar viejo si hubo otra pestaña):
    // el backend revalida atómicamente de todos modos.
    if (paymentMethod === 'credit') {
      try {
        const r = await api.getCreditBalance();
        const fresh = Number(r?.balance ?? NaN);
        if (Number.isFinite(fresh)) setCreditBalance(fresh);
        if (Number.isFinite(fresh) && fresh < trip) {
          creatingRef.current = false;
          setFormError(
            t('webshop2.neworder.errCreditShort', {
              balance: fresh.toLocaleString(),
              trip: trip.toLocaleString(),
            }),
          );
          return;
        }
      } catch {
        // Sin red no se puede validar: el backend decide.
      }
      if (creditBalance != null && creditBalance < trip) {
        creatingRef.current = false;
        setFormError(
          t('webshop2.neworder.errCreditShort', {
            balance: creditBalance.toLocaleString(),
            trip: trip.toLocaleString(),
          }),
        );
        return;
      }
    }
    if (isScheduled && (!scheduledDate || !scheduledTime)) {
      creatingRef.current = false;
      setFormError(t('webshop2.neworder.errSchedRequired'));
      return;
    }
    if (isScheduled && scheduledDate && scheduledTime) {
      // La hora elegida es hora CR aunque el celu esté en otra zona: el
      // backend también la lee como CR (parseScheduledCR).
      const when = new Date(`${scheduledDate}T${scheduledTime}:00-06:00`);
      if (!Number.isFinite(when.getTime()) || when.getTime() < Date.now()) {
        creatingRef.current = false;
        setFormError(t('webshop2.neworder.errSchedFuture'));
        return;
      }
    }
    // Sin internet el POST va a fallar: se avisa UNA vez y se conserva la
    // misma key para que el reintento no duplique cuando vuelva la red.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      creatingRef.current = false;
      setFormError(t('webshop2.neworder.errOffline'));
      return;
    }
    const idempotencyKey = ensureIdempotencyKey();
    setLoading(true);
    try {
      // Asignación directa en la creación: el backend crea el pedido YA
      // asignado y avisa SOLO al elegido. Sin esto, el pedido nacía en
      // concurso (alertando a toda la flota) y recién después se asignaba.
      // Efectivo: con cuánto pagan, para el vuelto del repartidor.
      const cashTenderedNum = cashTendered.trim() ? Number(cashTendered) : undefined;
      let result: any = null;
      try {
        result = await api.createOrder(
          {
            pickupAddress: pickupAddress || profileAddress || 'Nicoya Centro',
            deliveryAddress,
            deliveryZone: zoneForServer,
            payWithCredit: paymentMethod === 'credit',
            paymentMethod,
            cashTendered: cashTenderedNum,
            deliveryLat,
            deliveryLng,
            orderType: isScheduled ? 'scheduled' : 'immediate',
            scheduledDate: scheduledDate || undefined,
            scheduledTime: scheduledTime || undefined,
            customerName: deliveryName.trim() || undefined,
            customerPhone: deliveryPhone.trim() || undefined,
            specialInstructions: [`Cliente: ${deliveryName} (${deliveryPhone})`, notes]
              .filter(Boolean)
              .join(' · '),
            distanceKm: routeKm ?? undefined,
            kind,
            items:
              kind === 'food'
                ? items.map((item) => ({
                    menuItemId: item.menuItemId,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    notes: item.notes || undefined,
                  }))
                : [],
            packageDescription: kind === 'freight' ? packageDescription : undefined,
            ...(selectedDriverId ? { driverId: selectedDriverId } : {}),
          },
          { idempotencyKey },
        );
      } catch (createErr: any) {
        // El elegido se desconectó entre la lista y el crear: reintentar SIN
        // driver (queda en concurso) en vez de perder todo el formulario.
        const msg = String(createErr?.message ?? '');
        if (
          selectedDriverId &&
          /no está disponible|verificado|Repartidor no encontrado/i.test(msg)
        ) {
          console.warn('Direct driver unavailable, retrying as contest:', createErr);
          setOrderNotice(t('webshop2.neworder.errAssignFallback', { msg }));
          setSelectedDriverId(null);
          result = await api.createOrder(
            {
              pickupAddress: pickupAddress || profileAddress || 'Nicoya Centro',
              deliveryAddress,
              deliveryZone: zoneForServer,
              payWithCredit: paymentMethod === 'credit',
              paymentMethod,
              cashTendered: cashTenderedNum,
              deliveryLat,
              deliveryLng,
              orderType: isScheduled ? 'scheduled' : 'immediate',
              scheduledDate: scheduledDate || undefined,
              scheduledTime: scheduledTime || undefined,
              customerName: deliveryName.trim() || undefined,
              customerPhone: deliveryPhone.trim() || undefined,
              specialInstructions: [`Cliente: ${deliveryName} (${deliveryPhone})`, notes]
                .filter(Boolean)
                .join(' · '),
              distanceKm: routeKm ?? undefined,
              kind,
              items:
                kind === 'food'
                  ? items.map((item) => ({
                      menuItemId: item.menuItemId,
                      name: item.name,
                      price: item.price,
                      quantity: item.quantity,
                      notes: item.notes || undefined,
                    }))
                  : [],
              packageDescription: kind === 'freight' ? packageDescription : undefined,
            },
            { idempotencyKey },
          );
        } else {
          throw createErr;
        }
      }

      try {
        const { redirected } = await payForOrder(result.id, paymentMethod);
        if (redirected) {
          // Vamos a Onvo: no mostrar éxito local, al volver tracking verifica.
          // El pedido ya existe: consumir la key para no reutilizarla.
          idempotencyKeyRef.current = null;
          setCreatedOrderId(result.id);
          return;
        }
        if (paymentMethod === 'credit') {
          // Saldo real del servidor: el `- trip` optimista mentía si el
          // viaje cambió a mitad del vuelo (routeKm resolviendo tarde).
          try {
            const r = await api.getCreditBalance();
            setCreditBalance(Number(r?.balance ?? 0));
          } catch {
            setCreditBalance((b) => (b == null ? b : b - trip));
          }
        }
      } catch (paymentError: any) {
        console.error('Failed to create payment:', paymentError);
        // El pedido SÍ existe: no mostrar éxito limpio, sino reintento.
        setPaymentFailed(true);
        setPayError(paymentError?.message || t('webshop2.neworder.errPayFailed'));
      }

      setCreatedOrderId(result.id);
      setOrderCreated(true);
      // Pedido creado: la key ya se usó, la próxima creación necesita una nueva.
      idempotencyKeyRef.current = null;
      // Sin emit socket: el backend ya alerta a drivers cercanos vía
      // alertNearbyDrivers (socket 1:1 + push). El emit duplicaba el
      // evento order:new y el repartidor lo recibía 2 veces.
    } catch (error: any) {
      console.error('Failed to create order:', error);
      // La key se conserva: si el pedido SÍ se creó en el server pero la
      // respuesta se perdió (timeout/wifi), el reintento devuelve el mismo
      // pedido en vez de duplicarlo.
      setFormError(error?.message || t('webshop2.neworder.errCreate'));
    } finally {
      creatingRef.current = false;
      setLoading(false);
    }
  };

  const steps = [
    { num: 1 as Step, label: t('webshop2.neworder.stepOrder') },
    { num: 2 as Step, label: t('webshop2.neworder.stepDriver') },
    { num: 3 as Step, label: t('webshop2.neworder.stepConfirm') },
  ];

  if (orderCreated) {
    return (
      <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center p-4">
        <motion.div
          className="max-w-md w-full text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            {t('webshop2.neworder.createdTitle')}
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mb-4">
            {selectedDriverId
              ? t('webshop2.neworder.assignedYes')
              : t('webshop2.neworder.assignedNone')}
          </p>
          {orderNotice && (
            <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              {orderNotice}
            </div>
          )}
          {paymentFailed && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-left">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                {t('webshop2.neworder.payFailedTitle')}
              </p>
              {payError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{payError}</p>
              )}
              <button
                onClick={retryPayment}
                disabled={loading}
                className="mt-3 w-full rounded-xl bg-kiwi-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? t('webshop2.neworder.processing') : t('webshop2.neworder.retryPay')}
              </button>
            </div>
          )}
          <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 mb-6">
            <div className="flex justify-between">
              <span className="text-surface-500">{t('webshop2.neworder.number')}</span>
              <span className="font-semibold font-mono">#{createdOrderId?.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-surface-500">{t('webshop2.neworder.total')}</span>
              <span className="font-bold text-kiwi-700">₡{total.toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-3">
            {createdOrderId && (
              <ShareTrackingButton
                orderId={createdOrderId}
                label={t('webshop2.neworder.copyLink')}
                className="w-full justify-center"
              />
            )}
            <Link href="/dashboard">
              <AnimatedButton variant="gradient" className="w-full">
                <BarChart3 className="h-4 w-4 inline" /> {t('webshop2.neworder.backDashboard')}
              </AnimatedButton>
            </Link>
            <Link href="/orders">
              <AnimatedButton variant="secondary" className="w-full">
                <Package className="h-4 w-4 inline" /> {t('webshop2.neworder.trackLive')}
              </AnimatedButton>
            </Link>
            <AnimatedButton
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOrderCreated(false);
                setCreatedOrderId(null);
                setPaymentFailed(false);
                setPayError(null);
                setOrderNotice(null);
                setItems([]);
                setDeliveryName('');
                setDeliveryPhone('');
                setDeliveryAddress('');
                setDeliveryLat(undefined);
                setDeliveryLng(undefined);
                setStep(1);
              }}
            >
              {t('webshop2.neworder.createAnother')}
            </AnimatedButton>
          </div>
        </motion.div>
      </main>
    );
  }

  const menuFiltered = menuItems.filter(
    (m) => menuQuery.trim() === '' || m.name.toLowerCase().includes(menuQuery.trim().toLowerCase()),
  );

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex min-h-[44px] items-center gap-2 text-surface-600 dark:text-surface-400"
            >
              <span>←</span>
              <span className="text-sm font-medium">{t('webshop2.neworder.cancel')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              {t('webshop2.neworder.title')}
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <div className="mx-auto w-full max-w-lg px-4 py-4">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                    step >= s.num
                      ? 'bg-kiwi-700 text-white'
                      : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                  }`}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className="mt-1 text-xs font-medium text-surface-500">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`mx-2 mb-5 h-0.5 flex-1 ${step > s.num ? 'bg-kiwi-500' : 'bg-surface-200 dark:bg-surface-700'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-2">
        <AnimatePresence mode="wait">
          {/* PASO 1: pedido + entrega */}
          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              {' '}
              {showKindSelector ? (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: 'freight',
                        label: t('webshop2.neworder.kindFreight'),
                        desc: t('webshop2.neworder.kindFreightDesc'),
                      },
                      {
                        id: 'food',
                        label: t('webshop2.neworder.kindFood'),
                        desc: t('webshop2.neworder.kindFoodDesc'),
                      },
                    ] as const
                  ).map((k) => (
                    <button
                      key={k.id}
                      onClick={() => {
                        setKind(k.id);
                        setShowKindSelector(false);
                      }}
                      className={`rounded-xl p-3 text-left transition-all ${
                        kind === k.id
                          ? 'border-2 border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30'
                          : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                      }`}
                    >
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {k.label}
                      </p>
                      <p className="text-xs text-surface-500">{k.desc}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2.5">
                  <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
                    {kind === 'food'
                      ? t('webshop2.neworder.kindCurrentFood')
                      : t('webshop2.neworder.kindCurrentFreight')}
                  </span>
                  <button
                    onClick={() => setShowKindSelector(true)}
                    className="text-xs font-medium text-kiwi-700 dark:text-kiwi-400 underline"
                  >
                    {t('webshop2.neworder.change')}
                  </button>
                </div>
              )}
              {kind === 'food' ? (
                <>
                  <input
                    value={menuQuery}
                    onChange={(e) => setMenuQuery(e.target.value)}
                    placeholder={t('webshop2.neworder.searchMenu')}
                    className="mb-2 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2.5 text-sm focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                  />
                  <div className="mb-3 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {menuFiltered.map((m) => {
                      const line = items.find((i) => i.menuItemId === m.id);
                      const qty = line?.quantity || 0;
                      return (
                        <div
                          key={m.id}
                          className="rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-3"
                        >
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          <p className="text-xs text-kiwi-700">
                            ₡{Number(m.price).toLocaleString()}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {line && (
                              <>
                                <button
                                  onClick={() => bumpItem(line.id, -1)}
                                  className="h-7 w-7 rounded-lg bg-surface-100 dark:bg-surface-700"
                                >
                                  −
                                </button>
                                <span className="text-sm font-semibold w-4 text-center">{qty}</span>
                              </>
                            )}
                            <button
                              onClick={() =>
                                setItems((prev) => {
                                  const ex = prev.find((i) => i.menuItemId === m.id);
                                  if (ex)
                                    return prev.map((i) =>
                                      i.menuItemId === m.id
                                        ? { ...i, quantity: i.quantity + 1 }
                                        : i,
                                    );
                                  return [
                                    ...prev,
                                    {
                                      id: `quick-${m.id}`,
                                      menuItemId: m.id,
                                      name: m.name,
                                      quantity: 1,
                                      price: Number(m.price),
                                    },
                                  ];
                                })
                              }
                              className="h-7 flex-1 rounded-lg bg-kiwi-700 text-white text-sm font-medium"
                            >
                              {t('webshop2.neworder.add')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {menuFiltered.length === 0 && (
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">
                      {t('webshop2.neworder.noResults')}
                    </p>
                  )}
                  <div className="mb-4 flex gap-2">
                    <input
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      placeholder={t('webshop2.neworder.customName')}
                      className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={newItem.price || ''}
                      onChange={(e) =>
                        setNewItem({ ...newItem, price: parseInt(e.target.value) || 0 })
                      }
                      placeholder={t('webshop2.neworder.pricePh')}
                      className="w-24 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={addCustomItem}
                      className="rounded-xl bg-surface-800 dark:bg-surface-700 text-white px-4 text-sm"
                    >
                      +
                    </button>
                  </div>
                  {items.length > 0 && (
                    <div className="mb-4 space-y-1.5">
                      {items.map((i) => (
                        <div key={i.id} className="flex items-center justify-between text-sm">
                          <span className="text-surface-700 dark:text-surface-300">
                            {i.quantity}x {i.name}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-medium">
                              ₡{(i.price * i.quantity).toLocaleString()}
                            </span>
                            <button
                              onClick={() => bumpItem(i.id, -1)}
                              className="text-surface-500 dark:text-surface-400 hover:text-red-500"
                            >
                              ✕
                            </button>
                          </span>
                        </div>
                      ))}
                      <p className="text-right text-sm font-bold">
                        {t('webshop2.neworder.subtotal', { total: subtotal.toLocaleString() })}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="mb-4 space-y-3">
                  <textarea
                    value={packageDescription}
                    onChange={(e) => setPackageDescription(e.target.value)}
                    placeholder={t('webshop2.neworder.freightPh')}
                    rows={2}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-sm"
                  />
                </div>
              )}
              {/* Entrega */}
              <h3 className="mb-2 text-sm font-semibold text-surface-600 dark:text-surface-400">
                {t('webshop2.neworder.deliveryTitle')}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={deliveryName}
                    onChange={(e) => setDeliveryName(e.target.value)}
                    placeholder={t('webshop2.neworder.namePh')}
                    className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2.5 text-sm"
                  />
                  <input
                    value={deliveryPhone}
                    onChange={(e) => setDeliveryPhone(e.target.value)}
                    placeholder={t('webshop2.neworder.phonePh')}
                    type="tel"
                    className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2.5 text-sm"
                  />
                </div>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => onDeliveryChange(e.target.value)}
                  placeholder={t('webshop2.neworder.addressPh')}
                  rows={2}
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2.5 text-sm"
                />
                <ZonePicker value={deliveryZone} onChange={setDeliveryZone} />
                <div>
                  <button
                    onClick={() => setShowZonesMap((v) => !v)}
                    className="text-xs font-medium text-kiwi-700 dark:text-kiwi-400 underline underline-offset-2"
                  >
                    {showZonesMap
                      ? t('webshop2.neworder.zonesHide')
                      : t('webshop2.neworder.zonesShow')}
                  </button>
                  {showZonesMap && (
                    <div className="mt-2">
                      <DeliveryZonesMap
                        selectedId={deliveryZone}
                        onSelect={setDeliveryZone}
                        height={300}
                      />
                      <p className="mt-1 text-[11px] text-surface-500 dark:text-surface-400">
                        {t('webshop2.neworder.zonesMapHint')}
                      </p>
                    </div>
                  )}
                </div>
                {deliverySuggest.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
                    {deliverySuggest.map((s, i) => (
                      <button
                        key={`${s.lat}-${s.lng}-${i}`}
                        onClick={() => pickSuggestion(s)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-kiwi-50 dark:hover:bg-kiwi-900/20"
                      >
                        📍 {s.shortName || s.displayName}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                  <p className="mb-2 text-xs font-medium text-surface-500">
                    {t('webshop2.neworder.whatsappHint')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={mapLink}
                      onChange={(e) => setMapLink(e.target.value)}
                      placeholder={t('webshop2.neworder.mapPh')}
                      className="min-h-[44px] flex-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 text-sm"
                    />
                    <button
                      onClick={applyMapLink}
                      className="min-h-[44px] rounded-lg bg-kiwi-700 px-3 text-sm font-semibold text-white"
                    >
                      {t('webshop2.neworder.useBtn')}
                    </button>
                    <button
                      onClick={useCurrentLocation}
                      disabled={locating}
                      title={t('webshop2.neworder.useLocationTitle')}
                      className="min-h-[44px] rounded-lg bg-surface-200 dark:bg-surface-700 px-3 text-sm"
                    >
                      {locating ? t('webshop2.neworder.locating') : '📍'}
                    </button>
                  </div>
                  {mapLinkMsg && <p className="mt-1.5 text-xs text-surface-500">{mapLinkMsg}</p>}
                </div>
                {routeKm != null && (
                  <p className="text-xs text-surface-500">
                    {t('webshop2.neworder.routeKm', { km: routeKm })}
                    {etaMin != null ? t('webshop2.neworder.routeEta', { eta: etaMin }) : ''}
                    {t('webshop2.neworder.routeNote')}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* PASO 2: repartidor */}
          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <button
                onClick={() => setSelectedDriverId(null)}
                className={`mb-3 w-full text-left rounded-xl p-4 transition-all ${
                  selectedDriverId === null
                    ? 'border-2 border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30'
                    : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                }`}
              >
                <p className="font-medium">
                  {t('webshop2.neworder.contestTitle')} {selectedDriverId === null && '✓'}
                </p>
                <p className="text-xs text-surface-500">{t('webshop2.neworder.contestDesc')}</p>
              </button>
              {driverPresetNote && (
                <p className="mb-3 rounded-xl bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 px-3 py-2 text-xs text-gold-800 dark:text-gold-200">
                  {driverPresetNote}
                </p>
              )}
              {selectedDriverId !== null &&
                selectedDriverId === presetDriverId &&
                presetDriverId && (
                  <p className="mb-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/20 border border-kiwi-200 dark:border-kiwi-800 px-3 py-2 text-xs text-kiwi-800 dark:text-kiwi-200">
                    {t('webshop2.neworder.presetDirect', {
                      name: presetDriverName || t('webshop2.neworder.driverFallback'),
                    })}
                  </p>
                )}
              {selectedDriverId !== null && selectedDriverId !== presetDriverId && (
                <p className="mb-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/20 border border-kiwi-200 dark:border-kiwi-800 px-3 py-2 text-xs text-kiwi-800 dark:text-kiwi-200">
                  {t('webshop2.neworder.directOnly')}
                </p>
              )}
              <h3 className="mb-2 text-sm font-semibold text-surface-600 dark:text-surface-400">
                {t('webshop2.neworder.favTitle')}
              </h3>
              {driversLoading ? (
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  {t('webshop2.neworder.loading')}
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {favoriteDrivers.length === 0 && (
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {t('webshop2.neworder.noFavYet')}
                    </p>
                  )}
                  {favoriteDrivers.map((d) => (
                    <DriverRow
                      key={d.id}
                      driver={d}
                      selected={selectedDriverId === d.id}
                      isFav
                      onSelect={() => setSelectedDriverId(selectedDriverId === d.id ? null : d.id)}
                      onFav={() => toggleFavorite(d)}
                    />
                  ))}
                  <h3 className="pt-2 text-sm font-semibold text-surface-600 dark:text-surface-400">
                    {t('webshop2.neworder.availNow')}
                  </h3>
                  {availableDrivers.filter(
                    (d) => d.status === 'available' && !favoriteDrivers.some((f) => f.id === d.id),
                  ).length === 0 && (
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {t('webshop2.neworder.noneAvailable')}
                    </p>
                  )}
                  {availableDrivers
                    .filter(
                      (d) =>
                        d.status === 'available' && !favoriteDrivers.some((f) => f.id === d.id),
                    )
                    .map((d) => (
                      <DriverRow
                        key={d.id}
                        driver={d}
                        selected={selectedDriverId === d.id}
                        isFav={false}
                        onSelect={() =>
                          setSelectedDriverId(selectedDriverId === d.id ? null : d.id)
                        }
                        onFav={() => toggleFavorite(d)}
                      />
                    ))}
                  {favoriteDrivers.some((f) => f.status !== 'available') && (
                    <p className="mt-2 text-xs font-medium text-surface-500">
                      {t('webshop2.neworder.offlineFavNote')}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* PASO 3: confirmar */}
          {step === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <div className="mb-4 rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-surface-500">{t('webshop2.neworder.sumDeliverTo')}</span>
                  <span className="font-medium text-right max-w-[60%]">
                    {deliveryName} · {deliveryAddress}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-500">{t('webshop2.neworder.sumContent')}</span>
                  <span className="font-medium">
                    {kind === 'food'
                      ? t('webshop2.neworder.sumUnits', {
                          count: items.reduce((s, i) => s + i.quantity, 0),
                          total: subtotal.toLocaleString(),
                        })
                      : `${packageDescription || t('webshop2.neworder.sumFreightDefault')}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-500">{t('webshop2.neworder.sumDriver')}</span>
                  <span className="font-medium">
                    {selectedDriverId
                      ? (favoriteDrivers
                          .concat(availableDrivers)
                          .find((d) => d.id === selectedDriverId)?.fullName ??
                        t('webshop2.neworder.sumDriverChosen'))
                      : t('webshop2.neworder.sumContest')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-500">
                    {t('webshop2.neworder.sumShipping')}
                    {zoneLabel ? ` (${zoneLabel})` : routeKm != null ? ` (~${routeKm} km)` : ''}
                  </span>
                  <span className="text-kiwi-700 font-medium">₡{trip.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-surface-500">
                    {t('webshop2.neworder.sumDriverGets', { pct: Math.round(tripPct * 100) })}
                  </span>
                  <span className="font-medium text-surface-600 dark:text-surface-300">
                    ₡{driverPayout.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-surface-100 dark:border-surface-700">
                  <span>{t('webshop2.neworder.sumTotal')}</span>
                  <span className="text-kiwi-700">₡{total.toLocaleString()}</span>
                </div>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-surface-500 dark:text-surface-400">
                {t('webshop2.neworder.feeNote', { pct: Math.round(tripPct * 100) })}
              </p>

              <div className="mb-4 flex items-center justify-between rounded-xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4">
                <div>
                  <p className="font-medium text-sm">{t('webshop2.neworder.scheduleTitle')}</p>
                  <p className="text-xs text-surface-500">{t('webshop2.neworder.scheduleDesc')}</p>
                </div>
                <button
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={`relative h-8 w-14 rounded-full p-1 ${isScheduled ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'}`}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: isScheduled ? 24 : 0 }}
                  />
                </button>
              </div>
              {isScheduled && (
                <div className="mb-4 flex gap-2">
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <p className="mb-2 text-sm font-semibold text-surface-600 dark:text-surface-400">
                {t('webshop2.neworder.payTitle')}
              </p>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('webshop2.neworder.notesPh')}
                className="mb-3 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2.5 text-sm"
              />
              <div className="mb-2 grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'sinpe',
                      label: t('webshop2.neworder.paySinpe'),
                      on: payAvailability.sinpe,
                    },
                    { id: 'card', label: t('webshop2.neworder.payCard'), on: payAvailability.card },
                    {
                      id: 'crypto',
                      label: t('webshop2.neworder.payCrypto'),
                      on: payAvailability.crypto,
                    },
                    { id: 'cash', label: t('webshop2.neworder.payCash'), on: payAvailability.cash },
                    {
                      id: 'credit',
                      on: true,
                      label:
                        creditBalance == null
                          ? t('webshop2.neworder.payCredit')
                          : t('webshop2.neworder.payCreditBalance', {
                              amount: creditBalance.toLocaleString(),
                            }),
                    },
                  ] as const
                )
                  .filter((m) => m.on)
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`rounded-xl p-3 text-sm font-medium ${
                        paymentMethod === m.id
                          ? 'border-2 border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30'
                          : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
              </div>
              {paymentMethod === 'credit' && (
                <p className="mb-2 text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.neworder.creditNote', {
                    trip: trip.toLocaleString(),
                    pct: commissionPct,
                  })}
                </p>
              )}
              {paymentMethod === 'cash' && (
                <div className="mb-2">
                  <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-300">
                    {t('webshop2.neworder.cashTenderTitle')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder={t('webshop2.neworder.cashTenderPh')}
                    className="w-full max-w-xs rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                    {t('webshop2.neworder.cashTenderHint', { amount: trip.toLocaleString() })}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <div className="sticky bottom-0 border-t border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl p-4">
        <div className="mx-auto max-w-lg">
          {formError && (
            <div className="mb-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}
          {step === 1 && !step1Valid && (
            <p className="mb-3 text-center text-xs text-surface-500 dark:text-surface-400">
              {t('webshop2.neworder.missingPrefix', { missing: step1Missing.join(' · ') })}
            </p>
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
              className="flex-1"
            >
              {t('webshop2.neworder.back')}
            </AnimatedButton>
          )}
          {step < 3 ? (
            <AnimatedButton
              variant="gradient"
              onClick={() => {
                if (!step1Valid && step === 1) {
                  setFormError(t('webshop2.neworder.completeForm'));
                  return;
                }
                setFormError(null);
                setStep((step + 1) as Step);
              }}
              disabled={step === 1 && !step1Valid}
              className="flex-1"
            >
              {t('webshop2.neworder.next')}
            </AnimatedButton>
          ) : (
            <AnimatedButton
              variant="gradient"
              size="lg"
              className="flex-1 shadow-kiwi-lg"
              onClick={createOrderHandler}
              disabled={loading}
            >
              {loading
                ? t('webshop2.neworder.creating')
                : t('webshop2.neworder.createBtn', { total: total.toLocaleString() })}
            </AnimatedButton>
          )}
        </div>
      </div>
    </main>
  );
}

function DriverRow({
  driver,
  selected,
  isFav,
  onSelect,
  onFav,
}: {
  driver: Driver;
  selected: boolean;
  isFav: boolean;
  onSelect: () => void;
  onFav: () => void;
}) {
  // Solo los repartidores activos (Disponible) se pueden elegir; el resto se
  // muestra deshabilitado para que el comercio sepa que existe pero aún no
  // está conectado.
  const { t } = useTranslations();
  const selectable = driver.status === 'available';
  const vehicleLabels: Record<string, string> = {
    motorcycle: t('webshop2.neworder.vehMotorcycle'),
    motorized_bike: t('webshop2.neworder.vehMotorized'),
    bicycle: t('webshop2.neworder.vehBicycle'),
    car: t('webshop2.neworder.vehCar'),
    truck: t('webshop2.neworder.vehTruck'),
  };
  return (
    <div
      className={`flex items-center justify-between rounded-xl p-3 transition-all ${
        !selectable
          ? 'border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 opacity-60 cursor-not-allowed'
          : selected
            ? 'border-2 border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/30 cursor-pointer'
            : 'border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 cursor-pointer'
      }`}
      onClick={selectable ? onSelect : undefined}
    >
      {driver.photoUrl ? (
        // NOTE: <img> intencional — foto dinámica externa, next/image no aporta aquí
        <img
          src={driver.photoUrl}
          alt={driver.fullName}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kiwi-100 dark:bg-kiwi-900/30 text-sm font-bold text-kiwi-700 dark:text-kiwi-400">
          {driver.fullName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{driver.fullName}</p>
        <p className="text-xs text-surface-500">
          {driver.vehicleType ? (vehicleLabels[driver.vehicleType] ?? driver.vehicleType) : ''}{' '}
          {driver.vehiclePlate ? `· ${driver.vehiclePlate} ` : ''}
          {driver.rating != null ? `• ⭐ ${Number(driver.rating).toFixed(1)}` : ''}
          {!selectable &&
            ` • ${driver.status === 'busy' ? t('webshop2.neworder.driverBusy') : driver.status === 'offline' ? t('webshop2.neworder.driverOffline') : t('webshop2.neworder.driverUnavailable')}`}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFav();
        }}
        className="text-xl"
        title={isFav ? t('webshop2.neworder.favRemove') : t('webshop2.neworder.favAdd')}
      >
        {isFav ? '⭐' : '☆'}
      </button>
    </div>
  );
}

export default function NewOrder() {
  const { t } = useTranslations();
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] flex items-center justify-center">
          {t('webshop2.neworder.loadingFallback')}
        </main>
      }
    >
      <NewOrderWithKind />
    </Suspense>
  );
}

function NewOrderWithKind() {
  const searchParams = useSearchParams();
  const presetParam = searchParams.get('kind');
  const kind = presetParam === 'food' ? 'food' : 'freight';
  // Cuando la entrada ya preseleccionó el tipo (dashboard: Comida/Encomienda,
  // agregados rápidos), el formulario NO vuelve a preguntar.
  // presetDriverId: viene de Repartidores ("Crear pedido para este
  // repartidor") y preselecciona la asignación directa.
  const presetDriverId = searchParams.get('driverId');
  const presetDriverName = searchParams.get('driverName');
  return (
    <NewOrderInner
      presetKind={kind}
      isPreset={presetParam !== null}
      presetDriverId={presetDriverId}
      presetDriverName={presetDriverName}
    />
  );
}
