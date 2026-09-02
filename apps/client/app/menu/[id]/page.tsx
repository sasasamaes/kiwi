'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AnimatedButton, 
  StaggerContainer, 
  StaggerItem, 
  Skeleton,
  api,
  MenuItem,
  MerchantPublicProfile,
  useSocket
} from '@kiwi/ui';

interface CartItem extends MenuItem {
  quantity: number;
}

export default function MenuPage() {
  const params = useParams();
  const router = useRouter();
  const merchantId = params.id as string;

  const [merchant, setMerchant] = useState<MerchantPublicProfile | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todos']);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // Socket for real-time order updates
  const { isConnected } = useSocket();

  // Fetch merchant profile and menu items
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch merchant profile and menu items in parallel
      const [merchantData, menuData] = await Promise.all([
        api.getMerchantPublicProfile(merchantId),
        api.getMerchantMenuItems(merchantId),
      ]);

      setMerchant(merchantData);
      setMenuItems(menuData.items);
      setCategories(menuData.categories);
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

  // Cart functions
  const addToCart = useCallback((item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(c =>
          c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
        );
      }
      return prev.filter(c => c.id !== itemId);
    });
  }, []);

  const getItemQuantity = useCallback((itemId: string) => {
    return cart.find(c => c.id === itemId)?.quantity || 0;
  }, [cart]);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Filter items by category
  const filteredItems = selectedCategory === 'Todos'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  // Checkout handler
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0 || !merchant) return;

    setCheckingOut(true);
    try {
      // Create order with cart items
      const orderData = {
        merchantId: merchant.id,
        pickupAddress: merchant.address,
        deliveryAddress: 'Dirección del cliente', // TODO: Get from user input
        orderType: 'immediate',
        items: cart.map(item => ({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        specialInstructions: '',
        distanceKm: 2.5, // Default estimate
      };

      const order = await api.createOrder(orderData);
      
      // Clear cart and redirect to order confirmation
      setCart([]);
      router.push(`/order/${order.id}/confirmation`);
    } catch (err) {
      console.error('Failed to create order:', err);
      alert('Error al crear el pedido. Intenta de nuevo.');
    } finally {
      setCheckingOut(false);
    }
  }, [cart, merchant, router]);

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-bg-light dark:bg-surface-950 pb-32">
        {/* Header skeleton */}
        <div className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <div className="w-16" />
            </div>
          </div>
        </div>

        {/* Merchant info skeleton */}
        <div className="mx-auto max-w-lg px-4 py-6">
          <div className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* Menu items skeleton */}
        <div className="mx-auto max-w-lg px-4">
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark">
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
      <main className="min-h-screen bg-bg-light dark:bg-surface-950 flex items-center justify-center">
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
          <p className="text-surface-500 dark:text-surface-400 mb-6">
            {error}
          </p>
          <div className="flex gap-3 justify-center">
            <AnimatedButton variant="secondary" onClick={() => router.push('/')}>
              ← Volver
            </AnimatedButton>
            <AnimatedButton variant="gradient" onClick={fetchData}>
              🔄 Reintentar
            </AnimatedButton>
          </div>
        </motion.div>
      </main>
    );
  }

  // Merchant not found
  if (!merchant) {
    return (
      <main className="min-h-screen bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl mb-4 block">❌</span>
          <p className="text-surface-500 dark:text-surface-400">Comercio no encontrado</p>
          <Link href="/" className="mt-4 inline-block text-kiwi-600 hover:text-kiwi-700">
            ← Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-light dark:bg-surface-950 pb-32">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">Menú</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      {/* Restaurant Info */}
      <motion.div 
        className="mx-auto max-w-lg px-4 py-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/30 text-3xl">
              🥗
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                {merchant.businessName}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-surface-500 dark:text-surface-400">
                  ⭐ {merchant.rating.toFixed(1)} ({merchant.totalRatings})
                </span>
                <span className="text-sm text-surface-500 dark:text-surface-400">
                  📍 {merchant.address}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  merchant.isOpen 
                    ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400'
                    : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                }`}>
                  {merchant.isOpen ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
              {merchant.description && (
                <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                  {merchant.description}
                </p>
              )}
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
            <motion.button
              key={cat}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-kiwi-500 text-white shadow-kiwi'
                  : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 shadow-soft dark:shadow-dark'
              }`}
              onClick={() => setSelectedCategory(cat)}
              whileTap={{ scale: 0.95 }}
            >
              {cat}
            </motion.button>
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
            <span className="text-5xl mb-4 block">🍽️</span>
            <p className="text-surface-500 dark:text-surface-400">
              No hay productos en esta categoría
            </p>
          </div>
        ) : (
          <StaggerContainer className="space-y-4">
            {filteredItems.map((item) => {
              const quantity = getItemQuantity(item.id);
              
              return (
                <StaggerItem key={item.id}>
                  <motion.div 
                    className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex gap-4">
                      {/* Item Image */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 text-3xl flex-shrink-0">
                        {item.image || '🍽️'}
                      </div>
                      
                      {/* Item Info */}
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
                            </div>
                            {item.description && (
                              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-lg font-bold text-kiwi-600 dark:text-kiwi-400">
                            ₡{item.price.toLocaleString()}
                          </p>
                          
                          {/* Add to Cart */}
                          <div className="flex items-center gap-2">
                            {quantity > 0 && (
                              <motion.div 
                                className="flex items-center gap-2"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                              >
                                <motion.button
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                                  onClick={() => removeFromCart(item.id)}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  −
                                </motion.button>
                                <span className="w-6 text-center font-semibold text-surface-800 dark:text-surface-200">
                                  {quantity}
                                </span>
                              </motion.div>
                            )}
                            <motion.button
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-500 text-white shadow-kiwi"
                              onClick={() => addToCart(item)}
                              whileTap={{ scale: 0.9 }}
                              whileHover={{ scale: 1.1 }}
                              disabled={!merchant.isOpen}
                            >
                              +
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </motion.div>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div 
            className="fixed bottom-6 left-4 right-4 z-50"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
          >
            <motion.div 
              className="mx-auto max-w-lg rounded-2xl bg-kiwi-gradient p-4 text-white shadow-kiwi-lg cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCheckout}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="font-bold">{cartCount}</span>
                  </div>
                  <span className="font-semibold">
                    {checkingOut ? '⏳ Creando pedido...' : 'Ver carrito'}
                  </span>
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

      {/* Closed Store Banner */}
      {!merchant.isOpen && (
        <motion.div 
          className="fixed bottom-0 left-0 right-0 bg-red-500/90 text-white p-4 text-center backdrop-blur-xl"
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
