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
  useSocket,
  AddressInput
} from '@kiwi/ui';

interface CartItem extends MenuItem {
  quantity: number;
}

interface DeliveryInfo {
  address: string;
  phone: string;
  name: string;
  instructions: string;
}

const SAVED_ADDRESSES = [
  { id: 'home', label: '🏠 Casa', address: '' },
  { id: 'work', label: '💼 Trabajo', address: '' },
  { id: 'other', label: '📍 Otro', address: '' },
];

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
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Delivery info
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    address: '',
    phone: '',
    name: '',
    instructions: '',
  });
  const [selectedAddressType, setSelectedAddressType] = useState<string>('home');

  // Payment method
  type PaymentMethod = 'sinpe' | 'card' | 'cash';
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sinpe');

  // Socket for real-time order updates
  const { isConnected } = useSocket();

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
  const deliveryFee = cartTotal >= 5000 ? 0 : 500; // Free delivery over ₡5,000
  const totalWithDelivery = cartTotal + deliveryFee;

  // Filter items by category
  const filteredItems = selectedCategory === 'Todos'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  // Validate checkout
  const canCheckout = deliveryInfo.address.trim().length > 0 && 
                       deliveryInfo.phone.trim().length >= 8 &&
                       deliveryInfo.name.trim().length > 0;

  // Checkout handler
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0 || !merchant || !canCheckout) return;

    setCheckingOut(true);
    try {
      const orderData = {
        merchantId: merchant.id,
        pickupAddress: merchant.address,
        deliveryAddress: deliveryInfo.address,
        orderType: 'immediate',
        items: cart.map(item => ({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        specialInstructions: deliveryInfo.instructions,
        distanceKm: 2.5,
        customerPhone: deliveryInfo.phone,
        customerName: deliveryInfo.name,
        paymentMethod,
      };

      const order = await api.createOrder(orderData);
      
      setCart([]);
      setShowCheckout(false);
      setOrderSuccess(order.id);
    } catch (err) {
      console.error('Failed to create order:', err);
      alert('Error al crear el pedido. Intenta de nuevo.');
    } finally {
      setCheckingOut(false);
    }
  }, [cart, merchant, deliveryInfo, canCheckout]);

  // Order success screen
  if (orderSuccess) {
    return (
      <main className="min-h-screen bg-bg-light dark:bg-surface-950 flex items-center justify-center p-4">
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
            🎉
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            ¡Pedido Creado!
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mb-6">
            Tu pedido está buscando repartidor
          </p>
          
          <div className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark mb-6">
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
                <span className="font-bold text-kiwi-600 dark:text-kiwi-400">
                  ₡{totalWithDelivery.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link href={`/order/${orderSuccess}/tracking`}>
              <AnimatedButton variant="gradient" className="w-full">
                📍 Rastrear Pedido
              </AnimatedButton>
            </Link>
            <Link href="/">
              <AnimatedButton variant="secondary" className="w-full">
                🏠 Volver al inicio
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
      <main className="min-h-screen bg-bg-light dark:bg-surface-950 pb-32">
        <div className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-lg px-4 py-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <div className="w-16" />
            </div>
          </div>
        </div>
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
          <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <AnimatedButton variant="secondary" onClick={() => router.push('/')}>← Volver</AnimatedButton>
            <AnimatedButton variant="gradient" onClick={fetchData}>🔄 Reintentar</AnimatedButton>
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
          <Link href="/" className="mt-4 inline-block text-kiwi-600 hover:text-kiwi-700">← Volver al inicio</Link>
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
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/30 text-3xl">🥗</div>
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
            <p className="text-surface-500 dark:text-surface-400">No hay productos en esta categoría</p>
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
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 text-3xl flex-shrink-0">
                        {item.image || '🍽️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">{item.name}</h3>
                              {item.isPopular && (
                                <span className="px-2 py-0.5 rounded-full bg-gold-100 dark:bg-gold-900/50 text-xs font-medium text-gold-700 dark:text-gold-400">🔥 Popular</span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-lg font-bold text-kiwi-600 dark:text-kiwi-400">₡{item.price.toLocaleString()}</p>
                          <div className="flex items-center gap-2">
                            {quantity > 0 && (
                              <motion.div className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                                <motion.button
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
                                  onClick={() => removeFromCart(item.id)}
                                  whileTap={{ scale: 0.9 }}
                                >−</motion.button>
                                <span className="w-6 text-center font-semibold text-surface-800 dark:text-surface-200">{quantity}</span>
                              </motion.div>
                            )}
                            <motion.button
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-500 text-white shadow-kiwi"
                              onClick={() => addToCart(item)}
                              whileTap={{ scale: 0.9 }}
                              whileHover={{ scale: 1.1 }}
                              disabled={!merchant.isOpen}
                            >+</motion.button>
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
        {cartCount > 0 && !showCheckout && (
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
              onClick={() => setShowCheckout(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="font-bold">{cartCount}</span>
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
              <div className="sticky top-0 bg-white dark:bg-surface-800 pt-4 pb-2 px-6 border-b border-surface-100 dark:border-surface-700 rounded-t-3xl sm:rounded-t-3xl">
                <div className="w-12 h-1 bg-surface-300 dark:bg-surface-600 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                    🛒 Tu Pedido
                  </h2>
                  <motion.button
                    onClick={() => setShowCheckout(false)}
                    className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >✕</motion.button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Order Summary */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">📦 Resumen</h3>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{item.image || '🍽️'}</span>
                          <div>
                            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{item.name}</p>
                            <p className="text-xs text-surface-400">x{item.quantity}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                          ₡{(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Address */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">📍 Dirección de entrega</h3>
                  
                  {/* Saved Addresses */}
                  <div className="flex gap-2 mb-3">
                    {SAVED_ADDRESSES.map((addr) => (
                      <motion.button
                        key={addr.id}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                          selectedAddressType === addr.id
                            ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 ring-2 ring-kiwi-500'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                        }`}
                        onClick={() => setSelectedAddressType(addr.id)}
                        whileTap={{ scale: 0.95 }}
                      >
                        {addr.label}
                      </motion.button>
                    ))}
                  </div>

                  <AddressInput
                    value={deliveryInfo.address}
                    onChange={(address, coordinates) => {
                      setDeliveryInfo({ ...deliveryInfo, address });
                      if (coordinates) {
                        console.log('📍 Address coordinates:', coordinates);
                      }
                    }}
                    placeholder="Buscar dirección en Nicoya..."
                    nicoyaOnly={true}
                  />
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">👤 Nombre</h3>
                    <input
                      type="text"
                      value={deliveryInfo.name}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, name: e.target.value })}
                      placeholder="Tu nombre"
                      className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">📱 Teléfono</h3>
                    <input
                      type="tel"
                      value={deliveryInfo.phone}
                      onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                      placeholder="8888-1234"
                      className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">📝 Instrucciones (opcional)</h3>
                  <textarea
                    value={deliveryInfo.instructions}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, instructions: e.target.value })}
                    placeholder="Ej: Tocar el timbre, dejar en recepción, sin cebolla..."
                    rows={2}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">💳 Método de pago</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { id: 'sinpe' as const, icon: '📱', label: 'SINPE', desc: 'Transferencia' },
                      { id: 'card' as const, icon: '💳', label: 'Tarjeta', desc: 'Crédito/Débito' },
                      { id: 'cash' as const, icon: '💵', label: 'Efectivo', desc: 'Al repartidor' },
                    ]).map((method) => (
                      <motion.button
                        key={method.id}
                        type="button"
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                          paymentMethod === method.id
                            ? 'bg-kiwi-100 dark:bg-kiwi-900/50 ring-2 ring-kiwi-500 shadow-kiwi'
                            : 'bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600'
                        }`}
                        onClick={() => setPaymentMethod(method.id)}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span className="text-2xl">{method.icon}</span>
                        <span className={`text-sm font-semibold ${
                          paymentMethod === method.id
                            ? 'text-kiwi-700 dark:text-kiwi-400'
                            : 'text-surface-700 dark:text-surface-300'
                        }`}>
                          {method.label}
                        </span>
                        <span className="text-xs text-surface-400 dark:text-surface-500">
                          {method.desc}
                        </span>
                        {paymentMethod === method.id && (
                          <motion.div
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-kiwi-500 text-white text-xs flex items-center justify-center"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500 }}
                          >
                            ✓
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>

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
                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                        placeholder="Número SINPE (8888-1234)"
                        className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                      />
                      <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
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
                        💵 Paga en efectivo al repartidor cuando te entreguen tu pedido
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
                        💳 Se te redirigirá a OnvoPay para completar el pago seguro
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Price Summary */}
                <div className="rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">Subtotal</span>
                      <span className="text-surface-800 dark:text-surface-200">₡{cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-500 dark:text-surface-400">Envío</span>
                      <span className={deliveryFee === 0 ? 'text-kiwi-600 dark:text-kiwi-400 font-medium' : 'text-surface-800 dark:text-surface-200'}>
                        {deliveryFee === 0 ? 'Gratis 🎉' : `₡${deliveryFee.toLocaleString()}`}
                      </span>
                    </div>
                    {cartTotal < 5000 && (
                      <p className="text-xs text-kiwi-600 dark:text-kiwi-400">
                        🎉 Envío gratis en pedidos mayores a ₡5,000
                      </p>
                    )}
                    <div className="border-t border-surface-200 dark:border-surface-700 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-surface-800 dark:text-surface-200">Total</span>
                        <span className="text-xl font-bold text-kiwi-600 dark:text-kiwi-400">
                          ₡{totalWithDelivery.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkout Button */}
                <AnimatedButton
                  variant="gradient"
                  className="w-full"
                  onClick={handleCheckout}
                  disabled={!canCheckout || checkingOut}
                >
                  {checkingOut ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⏳</motion.span>
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
