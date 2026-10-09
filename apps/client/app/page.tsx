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
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';

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
}

const CITIES = [
  { slug: 'nicoya', name: 'Nicoya' },
  { slug: 'liberia', name: 'Liberia' },
];

export default function ClientHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [city, setCity] = useState('nicoya');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    const t = setTimeout(
      async () => {
        try {
          const [feed, bn] = await Promise.all([
            api.discoverMerchants({ city, q: q.trim() || undefined, take: 20 }),
            api.getBanners(city).catch(() => ({ items: [] })),
          ]);
          if (cancelled) return;
          setItems(feed.items ?? []);
          setBanners(bn.items ?? []);
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
  }, [city, q]);

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
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <KiwiLogo size={30} />
            <div className="flex items-center gap-2">
              {user ? (
                <Link
                  href="/orders"
                  className="text-sm font-medium text-kiwi-700 dark:text-kiwi-300 flex items-center gap-1"
                >
                  <User className="h-4 w-4" /> Mis pedidos
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-surface-600 dark:text-surface-300"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm font-semibold text-white bg-kiwi-600 rounded-full px-3 py-1.5"
                  >
                    Crear cuenta
                  </Link>
                </>
              )}
              <ThemeToggle />
            </div>
          </div>
          {/* Ciudad + búsqueda */}
          <div className="flex gap-2">
            <div className="flex rounded-full bg-surface-100 dark:bg-surface-800 p-1">
              {CITIES.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setCity(c.slug)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    city === c.slug
                      ? 'bg-white dark:bg-surface-700 font-semibold shadow'
                      : 'text-surface-500'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="flex-1 flex items-center gap-2 rounded-full bg-surface-100 dark:bg-surface-800 px-3">
              <Search className="h-4 w-4 text-surface-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar restaurantes…"
                className="bg-transparent flex-1 py-2 text-sm outline-none placeholder:text-surface-400"
              />
            </div>
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Banners patrocinados */}
        {banners.length > 0 && (
          <div className="mb-6 flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {banners.map((b) => (
              <button
                key={b.campaignId}
                onClick={() => router.push(`/menu/${b.merchantId}`)}
                className="relative shrink-0 w-72 rounded-2xl overflow-hidden bg-gradient-to-r from-kiwi-600 to-kiwi-500 text-white p-4 text-left"
              >
                <span className="absolute top-2 right-2 text-[10px] bg-black/30 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Megaphone className="h-3 w-3" /> Patrocinado
                </span>
                {b.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
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
              <div className="rounded-2xl glass p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 flex items-center gap-2">
                    <Camera className="h-5 w-5" /> Escanear QR
                  </h2>
                  <motion.button
                    onClick={stopScanner}
                    aria-label="Cerrar escáner"
                    whileTap={{ scale: 0.9 }}
                    className="rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
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
              className="rounded-2xl bg-kiwi-gradient p-6 text-white glow-kiwi-lg cursor-pointer overflow-hidden relative tactile"
              whileHover={{ scale: 1.02 }}
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
                  <h2 className="text-lg font-display font-bold">Escanear QR</h2>
                  <p className="text-white/80 text-sm">
                    Escanea el código del restaurante para ver el menú
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Feed real de comercios */}
        <ScrollReveal index={0}>
          <h2 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Restaurantes en{' '}
            {city === 'nicoya' ? 'Nicoya' : 'Liberia'}
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl glass p-4 animate-pulse">
                  <div className="h-4 w-2/3 bg-surface-200 dark:bg-surface-700 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-surface-200 dark:bg-surface-700 rounded" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl glass p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-kiwi-100 dark:bg-kiwi-900/30 mx-auto mb-3">
                <Camera className="h-8 w-8 text-kiwi-700 dark:text-kiwi-400" />
              </div>
              <p className="font-medium text-surface-800 dark:text-surface-200">
                Todavía no hay comercios por aquí
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                Usá el botón de arriba para escanear el QR de tu restaurante favorito
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => openMerchant(it)}
                  className="w-full text-left rounded-2xl glass p-4 hover:shadow-soft transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-400/10 font-display font-bold text-kiwi-700 dark:text-kiwi-300 overflow-hidden">
                      {it.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.logoUrl}
                          alt={it.businessName}
                          className="h-12 w-12 object-cover"
                        />
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
                            Patrocinado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                        {it.address}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="flex items-center gap-1 text-surface-600 dark:text-surface-300">
                          <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />
                          {it.rating.toFixed(1)} ({it.totalRatings})
                        </span>
                        <span className={it.isOpen ? 'text-kiwi-600' : 'text-red-500'}>
                          {it.isOpen ? 'Abierto' : 'Cerrado'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollReveal>

        {/* How it Works */}
        <ScrollReveal
          className="mt-8 rounded-2xl border border-transparent bg-white dark:bg-surface-800 dark:border-white/[0.06] p-6 shadow-soft dark:shadow-dark"
          index={1}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4 text-center">
            ¿Cómo funciona?
          </h3>
          <div className="space-y-4">
            {[
              { icon: Smartphone, title: 'Escanear QR', desc: 'En el restaurante o aqui' },
              { icon: ClipboardList, title: 'Elige tu comida', desc: 'Selecciona del menu' },
              { icon: CreditCard, title: 'Paga facil', desc: 'SINPE, tarjeta o efectivo' },
              { icon: Bike, title: 'Recibe en casa', desc: 'Tracking en tiempo real' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-400/10 dark:ring-1 dark:ring-kiwi-400/25">
                  <step.icon className="h-6 w-6 text-kiwi-700 dark:text-kiwi-300" />
                </div>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-100">{step.title}</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </main>
      <BottomNav />
    </div>
  );
}
