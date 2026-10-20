// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AnimatedButton,
  ThemeToggle,
  QRScanner,
  ScrollReveal,
  KiwiMark,
  KiwiLogo,
  api,
  useAuth,
  isEmojiImage,
  isHttpUrl,
  hoverCard,
  useTranslations,
  LanguageSwitcher,
} from '@kiwi/ui';
import {
  Camera,
  ClipboardList,
  CreditCard,
  Bike,
  Smartphone,
  X,
  Star,
  Search,
  MapPin,
  Megaphone,
  User,
  Store,
  MessageCircle,
  LayoutGrid,
  UtensilsCrossed,
  Pizza,
  Coffee,
  Croissant,
  Fish,
  Sandwich,
  Salad,
  Beer,
  CookingPot,
  Package,
  Sprout,
  ChevronRight,
  RotateCcw,
  CalendarDays,
  Heart,
  PackageSearch,
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { PushOptInCard } from './components/PushOptInCard';

interface DiscoverItem {
  id: string;
  businessName: string;
  address: string;
  description?: string | null;
  logoUrl?: string | null;
  rating: number;
  totalRatings: number;
  isOpen: boolean;
  isSponsored: boolean;
  campaignId?: string | null;
  distanceKm?: number | null;
  isHomeCook?: boolean;
}

/** Rating Decimal→string-safe: el backend puede serializar Decimal como string. */
// WhatsApp comercial de Kiwi (ventas/adhesión). Se configura en Vercel con
// NEXT_PUBLIC_SALES_WHATSAPP=506XXXXXXX. Fallback = placeholder visible.
const CATEGORIES = [
  { id: '', key: 'catAll', icon: LayoutGrid },
  { id: 'restaurante', key: 'catRestaurante', icon: UtensilsCrossed },
  { id: 'soda', key: 'catSoda', icon: Store },
  { id: 'pizzeria', key: 'catPizzeria', icon: Pizza },
  { id: 'cafe_brunch', key: 'catCafe', icon: Coffee },
  { id: 'panaderia', key: 'catPanaderia', icon: Croissant },
  { id: 'mariscos', key: 'catMariscos', icon: Fish },
  { id: 'comida_rapida', key: 'catRapida', icon: Sandwich },
  { id: 'saludable', key: 'catSaludable', icon: Salad },
  { id: 'cocina_casera', key: 'catCasera', icon: CookingPot },
  { id: 'bar', key: 'catBar', icon: Beer },
];

const SALES_WA_NUMBER = process.env.NEXT_PUBLIC_SALES_WHATSAPP || '50688264007';
const waLink = (text: string) =>
  `https://wa.me/${SALES_WA_NUMBER}?text=${encodeURIComponent(text)}`;

/** Comunidad de WhatsApp de KiwiCR (ofertas, pautas y novedades). */
const COMMUNITY_URL =
  process.env.NEXT_PUBLIC_WA_COMMUNITY || 'https://chat.whatsapp.com/IY4TzyYBWij1MO7Nz61UGt';
/** Número comercial visible (+506 8826 4007). */
const SALES_WA_DISPLAY = '+506 8826 4007';

const formatRating = (v: unknown): string => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number).toFixed(1) : '5.0';
};

const STEPS = [
  { icon: Smartphone, titleKey: 'stepScanTitle', descKey: 'stepScanDesc' },
  { icon: ClipboardList, titleKey: 'stepFoodTitle', descKey: 'stepFoodDesc' },
  { icon: CreditCard, titleKey: 'stepPayTitle', descKey: 'stepPayDesc' },
  { icon: Bike, titleKey: 'stepHomeTitle', descKey: 'stepHomeDesc' },
];

export default function ClientHome() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslations();
  const [showScanner, setShowScanner] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // Lanzamiento 23 en Nicoya: ciudad fija. Liberia es a futuro
  // (el backend ya segmenta por ciudad; para activarla se muestra el toggle).
  const [city] = useState('nicoya');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  // Vitrina de mañana (preventa del día antes). Solo en la vista general.
  const [tomorrow, setTomorrow] = useState<
    Array<{
      merchantId: string;
      businessName: string;
      logoUrl: string | null;
      isHomeCook: boolean;
      items: Array<{ id: string; name: string; price: number; stockQty: number | null }>;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locDenied, setLocDenied] = useState(false);
  /** Feature flags del admin: muestran u ocultan secciones del inicio. */
  const [showEncomienda, setShowEncomienda] = useState(true);
  const [showMercadito, setShowMercadito] = useState(true);
  const [showBanners, setShowBanners] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getFeatureFlags()
      .then((f) => {
        if (cancelled) return;
        setShowEncomienda(f.encomiendaEnabled !== false);
        setShowMercadito((f as any).mercaditoEnabled !== false);
        setShowBanners((f as any).bannersEnabled !== false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  // Baymard: el re-pedido es el hábito #1 — rail "Pedir de nuevo" con el último entregado.
  const [lastDelivered, setLastDelivered] = useState<{
    id: string;
    businessName: string;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      setLastDelivered(null);
      return;
    }
    let cancelled = false;
    api
      .getMyOrders()
      .then((orders: any[]) => {
        if (cancelled || !Array.isArray(orders)) return;
        const done = orders
          .filter((o) => o?.status === 'delivered')
          .sort(
            (a, b) =>
              new Date(b.deliveredAt || b.createdAt).getTime() -
              new Date(a.deliveredAt || a.createdAt).getTime(),
          )[0];
        if (done?.merchant?.id || done?.merchantId) {
          setLastDelivered({
            id: done.merchant?.id ?? done.merchantId,
            businessName: done.merchant?.businessName || '',
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleScan = useCallback(
    (merchantId: string, url: string) => {
      setShowScanner(false);
      setScannerActive(false);
      router.push(`/menu/${merchantId}`);
    },
    [router],
  );

  const handleScanError = useCallback((error: string) => {
    setScanError(error);
    setTimeout(() => setScanError(null), 3000);
  }, []);

  const startScanner = useCallback(() => {
    setScannerActive(true);
    setShowScanner(true);
    setScanError(null);
  }, []);

  const stopScanner = useCallback(() => {
    setScannerActive(false);
    setShowScanner(false);
  }, []);

  useEffect(() => {
    return () => {
      setScannerActive(false);
    };
  }, []);

  // Feed real: sponsored primero (lo ordena el server), segmentado por ciudad.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFeedError(false);
    const t = setTimeout(
      async () => {
        try {
          const [feed, bn] = await Promise.all([
            api.discoverMerchants({
              city,
              q: q.trim() || undefined,
              category: category || undefined,
              take: 20,
              ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
            }),
            api.getBanners(city).catch(() => ({ items: [] })),
          ]);
          if (cancelled) return;
          setItems(feed.items ?? []);
          setBanners(bn.items ?? []);
          // Vitrina de mañana solo en la vista general (sin búsqueda ni filtro).
          if (!q.trim() && !category) {
            api
              .getTomorrowPreview(city)
              .then((t) => {
                if (!cancelled) setTomorrow(t.items ?? []);
              })
              .catch(() => undefined);
          } else if (!cancelled) {
            setTomorrow([]);
          }
          // Métrica: impresiones de sponsored (best-effort, no bloquea).
          for (const it of (feed.items ?? []).filter(
            (i: DiscoverItem) => i.isSponsored && i.campaignId,
          )) {
            void api
              .recordAdEvent({ campaignId: it.campaignId, type: 'impression' })
              .catch(() => undefined);
          }
        } catch {
          if (!cancelled) {
            setItems([]);
            setBanners([]);
            setFeedError(true);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      q ? 400 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [city, q, reloadKey, coords, category]);

  const useMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocDenied(true);
      return;
    }
    setLocating(true);
    setLocDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocDenied(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  const openMerchant = (it: DiscoverItem) => {
    if (it.isSponsored && it.campaignId) {
      void api.recordAdEvent({ campaignId: it.campaignId, type: 'click' }).catch(() => undefined);
    }
    router.push(`/menu/${it.id}`);
  };

  return (
    <div className="relative min-h-[100dvh] bg-bg-light dark:bg-surface-950 pb-20 overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-kiwi-500/10 blur-3xl" />
        <div className="absolute top-1/3 -left-24 h-56 w-56 rounded-full bg-kiwi-400/[0.07] blur-3xl" />
        <div className="absolute bottom-24 -right-24 h-56 w-56 rounded-full bg-gold-500/[0.06] blur-3xl" />
      </div>
      <motion.header
        className="pt-safe sticky top-0 z-50 glass-strong"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg lg:max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex min-w-0 flex-col leading-tight">
              <KiwiLogo size={30} />
              <span className="mt-1 truncate font-display text-[11px] italic tracking-wide text-surface-500 dark:text-surface-400">
                {t('wclihome.home.brandTagline')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <Link
                  href="/profile"
                  className="text-sm font-medium text-kiwi-700 dark:text-kiwi-300 flex items-center gap-1"
                >
                  <User className="h-4 w-4" /> {t('wclihome.home.account')}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="whitespace-nowrap text-sm font-medium text-surface-600 dark:text-surface-300"
                  >
                    {t('wclihome.home.login')}
                  </Link>
                  <Link
                    href="/register"
                    className="whitespace-nowrap text-sm font-semibold text-white bg-kiwi-700 rounded-full px-3 py-1.5"
                  >
                    {t('wclihome.home.register')}
                  </Link>
                </>
              )}
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
          {/* Búsqueda (una sola ciudad por ahora: Nicoya) */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-full bg-surface-100 dark:bg-surface-800 px-3">
              <Search className="h-4 w-4 text-surface-500 dark:text-surface-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('wclihome.home.searchPlaceholder')}
                aria-label={t('wclihome.home.searchAria')}
                className="bg-transparent flex-1 py-2 text-sm outline-none placeholder:text-surface-400"
              />
            </div>
            <button
              onClick={useMyLocation}
              disabled={locating}
              title={coords ? t('wclihome.home.nearActiveTitle') : t('wclihome.home.nearTitle')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm shrink-0 transition-colors ${
                coords
                  ? 'bg-kiwi-600 text-white font-semibold'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300'
              }`}
            >
              <MapPin className="h-4 w-4" />
              {locating
                ? '…'
                : coords
                  ? t('wclihome.home.nearActive')
                  : t('wclihome.home.nearDefault')}
            </button>
          </div>
          {locDenied && !coords && (
            <p className="text-xs text-surface-500 mt-2">{t('wclihome.home.locDenied')}</p>
          )}
          {/* Categorías de negocios */}
          <div className="flex gap-2 overflow-x-auto pb-1 pt-3 -mx-4 px-4 scrollbar-hide">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              const Icon = c.icon;
              return (
                <button
                  key={c.id || 'todos'}
                  onClick={() => setCategory(c.id)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/50 active:scale-95 ${
                    active
                      ? 'bg-kiwi-700 text-white font-semibold shadow-card'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 [@media(hover:hover)]:hover:bg-surface-200 dark:[@media(hover:hover)]:hover:bg-surface-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(`wclihome.home.${c.key}`)}
                </button>
              );
            })}
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg lg:max-w-5xl px-4 py-6">
        {/* Atajos: icono con tinte por acción, jerarquía serif, chevron */}
        <div className="mb-4 grid gap-3">
          {showEncomienda && (
            <Link
              href="/encomienda"
              className={`flex items-center gap-3 rounded-2xl border border-surface-200/60 bg-white p-4 shadow-card dark:border-white/[0.06] dark:bg-surface-800 ${hoverCard} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/40 active:scale-[0.99]`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
                <Package className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[17px] font-bold leading-snug text-surface-900 dark:text-surface-100">
                  {t('wclihome.home.encomiendaTitle')}
                </span>
                <span className="block text-xs text-surface-500 dark:text-surface-400">
                  {t('wclihome.home.encomiendaDesc')}
                </span>
              </span>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-kiwi-700 dark:text-kiwi-300"
                aria-hidden
              />
            </Link>
          )}
          {showMercadito && (
            <Link
              href="/zona-azul"
              className={`flex items-center gap-3 rounded-2xl border border-gold-500/25 bg-gradient-to-r from-gold-50 via-white to-white p-4 shadow-card dark:border-gold-400/20 dark:from-gold-400/10 dark:via-surface-800 dark:to-surface-800 ${hoverCard} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40 active:scale-[0.99]`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-700 dark:bg-gold-400/10 dark:text-gold-300">
                <Sprout className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[17px] font-bold leading-snug text-surface-900 dark:text-surface-100">
                  {t('wclihome.home.mercaditoTitle')}
                </span>
                <span className="block text-xs text-surface-500 dark:text-surface-400">
                  {t('wclihome.home.mercaditoDesc')}
                </span>
              </span>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-gold-700 dark:text-gold-300"
                aria-hidden
              />
            </Link>
          )}
        </div>
        {/* Pedir de nuevo: el hábito más común, al frente */}
        {lastDelivered && (
          <button
            onClick={() => router.push(`/menu/${lastDelivered.id}`)}
            className={`mb-6 flex w-full items-center gap-3 rounded-2xl border border-kiwi-600/25 bg-kiwi-50/60 p-4 text-left shadow-card dark:border-kiwi-400/20 dark:bg-kiwi-400/[0.07] ${hoverCard} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/40 active:scale-[0.99]`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kiwi-700 text-white">
              <RotateCcw className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-kiwi-700 dark:text-kiwi-300">
                {t('wclihome.home.reorderTitle')}
              </span>
              <span className="block truncate font-display text-[17px] font-bold leading-snug text-surface-900 dark:text-surface-100">
                {lastDelivered.businessName || t('wclihome.home.reorderFallback')}
              </span>
            </span>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-kiwi-700 dark:text-kiwi-300"
              aria-hidden
            />
          </button>
        )}
        {lastDelivered === null && <div className="mb-6" aria-hidden />}
        {/* Banners patrocinados */}{' '}
        {showBanners && banners.length > 0 && (
          <div className="mb-6 flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {banners.map((b) => (
              <button
                key={b.campaignId}
                onClick={() => router.push(`/menu/${b.merchantId}`)}
                className="relative shrink-0 w-72 rounded-2xl overflow-hidden bg-gradient-to-r from-kiwi-600 to-kiwi-500 text-white p-4 text-left"
              >
                <span className="absolute top-2 right-2 text-[10px] bg-black/30 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Megaphone className="h-3 w-3" /> {t('wclihome.home.sponsored')}
                </span>
                {b.imageUrl ? (
                  // NOTE: <img> intencional — imágenes dinámicas de Cloudinary (sin dominio fijo).
                  <img
                    src={b.imageUrl}
                    alt={b.title || b.businessName}
                    className="rounded-xl h-28 w-full object-cover mb-2"
                  />
                ) : null}
                <p className="font-display font-bold leading-tight">{b.title || b.businessName}</p>
                <p className="text-white/80 text-xs mt-0.5">{b.businessName}</p>
              </button>
            ))}
          </div>
        )}
        {/* Vitrina de mañana: lo que se vende mañana se aparta hoy */}
        {tomorrow.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700 dark:text-orange-300">
              {t('wclihome.home.presaleEyebrow')}
            </p>
            <p className="font-display text-[19px] font-bold tracking-tight text-surface-900 dark:text-surface-100 mb-1 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-orange-600 dark:text-orange-300" aria-hidden />
              {t('wclihome.home.presaleTitle')}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">
              {t('wclihome.home.presaleHint')}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {tomorrow.map((tm) => (
                <button
                  key={tm.merchantId}
                  onClick={() => router.push(`/menu/${tm.merchantId}`)}
                  className="shrink-0 w-64 rounded-2xl overflow-hidden border-2 border-orange-500/40 dark:border-orange-400/30 bg-white dark:bg-surface-800 p-4 text-left shadow-soft"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/40 overflow-hidden">
                      {isHttpUrl(tm.logoUrl) ? (
                        // NOTE: <img> intencional — logos dinámicos de Cloudinary.
                        <img
                          src={tm.logoUrl}
                          alt={tm.businessName}
                          className="h-9 w-9 object-cover"
                        />
                      ) : isEmojiImage(tm.logoUrl) ? (
                        <span className="text-xl leading-none">{tm.logoUrl}</span>
                      ) : (
                        <span className="font-bold text-orange-700 dark:text-orange-300">
                          {tm.businessName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-surface-800 dark:text-surface-100 truncate">
                        {tm.businessName}
                      </p>
                      {tm.isHomeCook && (
                        <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 dark:text-orange-300">
                          <CookingPot className="h-3 w-3" aria-hidden />{' '}
                          {t('wclihome.home.homeCook')}
                        </p>
                      )}
                    </div>
                  </div>
                  {tm.items.slice(0, 2).map((i) => (
                    <p
                      key={i.id}
                      className="text-xs text-surface-600 dark:text-surface-300 truncate"
                    >
                      • {i.name} — ₡{Number(i.price).toLocaleString()}
                      {typeof i.stockQty === 'number'
                        ? ` ${t('wclihome.home.stockLeft', { count: i.stockQty })}`
                        : ''}
                    </p>
                  ))}
                  <p className="mt-2 text-xs font-semibold text-orange-700 dark:text-orange-300">
                    {t('wclihome.home.reserveCta')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* QR Scanner View */}
        <AnimatePresence mode="wait">
          {showScanner && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-6"
            >
              <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 flex items-center gap-2">
                    <Camera className="h-5 w-5" /> {t('wclihome.home.scannerTitle')}
                  </h2>
                  <motion.button
                    onClick={stopScanner}
                    aria-label={t('wclihome.home.scannerClose')}
                    whileTap={{ scale: 0.9 }}
                    className="rounded-full text-surface-500 dark:text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </div>
                <QRScanner onScan={handleScan} onError={handleScanError} isActive={scannerActive} />
                <AnimatePresence>
                  {scanError && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 rounded-xl bg-red-50 dark:bg-red-900/30 p-3 text-center"
                    >
                      <p className="text-sm text-red-600 dark:text-red-400">{scanError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* QR hero */}
        {!showScanner && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.div
              role="button"
              tabIndex={0}
              aria-label={t('wclihome.home.qrAria')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') startScanner();
              }}
              className="rounded-2xl bg-kiwi-gradient p-6 text-white shadow-card cursor-pointer overflow-hidden relative transition-transform duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              whileTap={{ scale: 0.98 }}
              onClick={startScanner}
            >
              <motion.div
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
              <div className="pointer-events-none absolute -right-3 -top-4 opacity-90">
                <KiwiMark size={64} />
              </div>
              <div className="relative flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                  <Camera className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold">{t('wclihome.home.qrTitle')}</h2>
                  <p className="text-white/80 text-sm">{t('wclihome.home.qrDesc')}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {/* Feed real de comercios */}
        <PushOptInCard />
        <ScrollReveal index={0}>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-kiwi-700 dark:text-kiwi-300">
            {t('wclihome.home.feedEyebrow')}
          </p>
          <h2 className="font-display text-[22px] font-bold tracking-tight text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-kiwi-700 dark:text-kiwi-300" aria-hidden />
            {t('wclihome.home.feedTitle')}
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4 shadow-soft dark:shadow-dark animate-pulse"
                >
                  <div className="h-4 w-2/3 bg-surface-200 dark:bg-surface-700 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-surface-200 dark:bg-surface-700 rounded" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-kiwi-100 dark:bg-kiwi-400/10 mx-auto mb-3">
                <PackageSearch className="h-8 w-8 text-kiwi-700 dark:text-kiwi-300" aria-hidden />
              </div>
              <p className="font-medium text-surface-800 dark:text-surface-200">
                {feedError ? t('wclihome.home.emptyErrorTitle') : t('wclihome.home.emptyTitle')}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                {feedError ? t('wclihome.home.emptyErrorDesc') : t('wclihome.home.emptyDesc')}
              </p>
              {feedError && (
                <button
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-3 rounded-xl bg-kiwi-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  {t('wclihome.home.retry')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => openMerchant(it)}
                  className={`w-full text-left rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] p-4 shadow-card dark:shadow-dark ${hoverCard} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/40 active:scale-[0.99]`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 text-xl dark:bg-kiwi-400/10 font-display font-bold text-kiwi-700 dark:text-kiwi-300 overflow-hidden">
                      {isHttpUrl(it.logoUrl) ? (
                        // NOTE: <img> intencional — logos dinámicos de Cloudinary.
                        <img
                          src={it.logoUrl}
                          alt={it.businessName}
                          className="h-12 w-12 object-cover"
                        />
                      ) : isEmojiImage(it.logoUrl) ? (
                        <span className="text-2xl leading-none">{it.logoUrl}</span>
                      ) : (
                        it.businessName.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-surface-800 dark:text-surface-100 truncate">
                          {it.businessName}
                        </p>
                        {it.isSponsored && (
                          <span className="text-[10px] font-semibold bg-gold-500/20 text-gold-700 dark:text-gold-400 rounded-full px-2 py-0.5 shrink-0">
                            {t('wclihome.home.sponsored')}
                          </span>
                        )}
                        {it.isHomeCook && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-orange-500/15 text-orange-700 dark:text-orange-300 rounded-full px-2 py-0.5 shrink-0">
                            <CookingPot className="h-3 w-3" aria-hidden />{' '}
                            {t('wclihome.home.cardHomeCook')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                        {it.address}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="flex items-center gap-1 text-surface-600 dark:text-surface-300">
                          <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />
                          {formatRating(it.rating)} ({it.totalRatings})
                        </span>
                        {it.distanceKm != null && (
                          <span className="flex items-center gap-1 text-surface-600 dark:text-surface-300">
                            <MapPin className="h-3.5 w-3.5" />
                            {t('wclihome.home.distance', { count: it.distanceKm })}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${it.isOpen ? 'text-kiwi-700 dark:text-kiwi-300' : 'text-surface-400'}`}
                        >
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 rounded-full ${it.isOpen ? 'bg-kiwi-600' : 'bg-surface-300'}`}
                          />
                          {it.isOpen ? t('wclihome.home.open') : t('wclihome.home.closed')}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollReveal>
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
          {/* Comunidad KiwiCR: ofertas, pautas y novedades por WhatsApp */}
          <ScrollReveal index={1} className="lg:h-full lg:col-span-2">
            <div className="mt-8 rounded-2xl overflow-hidden border border-kiwi-600/25 dark:border-kiwi-400/20 bg-gradient-to-br from-kiwi-500/15 via-white to-white dark:from-kiwi-500/10 dark:via-surface-800 dark:to-surface-800 p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kiwi-600/15">
                  <MessageCircle className="h-6 w-6 text-kiwi-700 dark:text-kiwi-300" />
                </div>
                <div>
                  <p className="font-display font-bold text-surface-800 dark:text-surface-100">
                    {t('wclihome.home.communityTitle')}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {t('wclihome.home.communityDesc')}
                  </p>
                </div>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-300 mb-4">
                {t('wclihome.home.communityBody', { phone: SALES_WA_DISPLAY })}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={COMMUNITY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  <MessageCircle className="h-4 w-4" /> {t('wclihome.home.communityJoin')}
                </a>
                <a
                  href={`https://wa.me/${SALES_WA_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-kiwi-600/30 px-4 py-3 text-sm font-semibold text-kiwi-700 dark:text-kiwi-300"
                >
                  <Smartphone className="h-4 w-4" /> {SALES_WA_DISPLAY}
                </a>
              </div>
            </div>
          </ScrollReveal>
          {/* Banner comercio: pautar + usar la app (manda al WhatsApp del negocio) */}
          <ScrollReveal index={1} className="lg:h-full">
            <div className="mt-8 rounded-2xl overflow-hidden border border-gold-500/30 dark:border-gold-500/20 bg-gradient-to-br from-gold-500/15 via-white to-white dark:from-gold-500/10 dark:via-surface-800 dark:to-surface-800 p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/20">
                  <Store className="h-6 w-6 text-gold-700 dark:text-gold-400" />
                </div>
                <div>
                  <p className="font-display font-bold text-surface-800 dark:text-surface-100">
                    {t('wclihome.home.bizTitle')}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {t('wclihome.home.bizDesc')}
                  </p>
                </div>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-300 mb-4">
                {t('wclihome.home.bizBody')}
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href={waLink(t('wclihome.home.bizWaMessage'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  <MessageCircle className="h-4 w-4" /> {t('wclihome.home.bizAdvertise')}
                </a>
                <a
                  href={COMMUNITY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-kiwi-600/30 px-4 py-3 text-sm font-semibold text-kiwi-700 dark:text-kiwi-300"
                >
                  <Store className="h-4 w-4" /> {t('wclihome.home.bizUse')}
                </a>
                <a
                  href={COMMUNITY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-700 dark:text-orange-300"
                >
                  <CookingPot className="h-4 w-4" /> {t('wclihome.home.bizHomeCook')}
                </a>
              </div>
            </div>
          </ScrollReveal>

          {/* How it Works */}
          <ScrollReveal
            className="mt-8 rounded-2xl border border-transparent bg-white dark:bg-surface-800 dark:border-white/[0.06] p-6 shadow-soft dark:shadow-dark"
            index={1}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4 text-center">
              {t('wclihome.home.howTitle')}
            </h3>
            <div className="space-y-4">
              {STEPS.map((step) => (
                <div key={step.titleKey} className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-400/10 dark:ring-1 dark:ring-kiwi-400/25">
                    <step.icon className="h-6 w-6 text-kiwi-700 dark:text-kiwi-300" />
                  </div>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-100">
                      {t(`wclihome.home.${step.titleKey}`)}
                    </p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      {t(`wclihome.home.${step.descKey}`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
