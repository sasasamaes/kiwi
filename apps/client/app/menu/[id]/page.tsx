'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton, StaggerContainer, StaggerItem } from '@kiwi/ui';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isPopular?: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

const menuItems: MenuItem[] = [
  // Bowls
  { id: '1', name: 'Bowl Tropikal', description: 'Arroz, pollo, aguacate, mango, leche de coco', price: 4500, image: '🥗', category: 'Bowls', isPopular: true },
  { id: '2', name: 'Bowl Verde', description: 'Quinoa, espinaca, pepino, aguacate, limón', price: 4200, image: '🥬', category: 'Bowls' },
  { id: '3', name: 'Bowl Hawaiian', description: 'Arroz, salmón, mango, pepino, salsa teriyaki', price: 5500, image: '🍣', category: 'Bowls', isPopular: true },
  { id: '4', name: 'Bowl Proteína', description: 'Arroz, res, huevo, aguacate, frijoles', price: 4800, image: '🥩', category: 'Bowls' },
  // Café
  { id: '5', name: 'Café Americano', description: 'Café de grano nicoyano', price: 1200, image: '☕', category: 'Café' },
  { id: '6', name: 'Latte', description: 'Espresso con leche vaporizada', price: 1800, image: '☕', category: 'Café', isPopular: true },
  { id: '7', name: 'Smoothie Verde', description: 'Espinaca, plátano, mango, jengibre', price: 2500, image: '🥤', category: 'Café' },
  // Snacks
  { id: '8', name: 'Patacones', description: 'Plátano frito con pico de gallo', price: 1800, image: '🍌', category: 'Snacks' },
  { id: '9', name: 'Empanadas (3)', description: 'Pollo o carne, con salsa', price: 2200, image: '🥟', category: 'Snacks' },
];

const categories = ['Todos', 'Bowls', 'Café', 'Snacks'];

export default function MenuPage() {
  const params = useParams();
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const filteredItems = selectedCategory === 'Todos'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find(c => c.id === item.id);
    if (existingItem) {
      setCart(cart.map(c => 
        c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    const existingItem = cart.find(c => c.id === itemId);
    if (existingItem && existingItem.quantity > 1) {
      setCart(cart.map(c => 
        c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
      ));
    } else {
      setCart(cart.filter(c => c.id !== itemId));
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const getItemQuantity = (itemId: string) => {
    return cart.find(c => c.id === itemId)?.quantity || 0;
  };

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
                Bowl & Café Luis Alfredo
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-surface-500 dark:text-surface-400">⭐ 4.9</span>
                <span className="text-sm text-surface-500 dark:text-surface-400">🕐 20-30 min</span>
                <span className="px-2 py-0.5 rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-xs font-medium text-kiwi-700 dark:text-kiwi-400">
                  Abierto
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
                      {item.image}
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
                          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
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
            <Link href={`/order/checkout?items=${JSON.stringify(cart)}`}>
              <motion.div 
                className="mx-auto max-w-lg rounded-2xl bg-kiwi-gradient p-4 text-white shadow-kiwi-lg cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
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
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
