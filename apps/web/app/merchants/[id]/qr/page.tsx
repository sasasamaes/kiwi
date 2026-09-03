'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { QRCodeGenerator, useAuth, api, StaggerContainer, StaggerItem } from '@kiwi/ui';

interface MerchantData {
  id: string;
  businessName: string;
  address: string;
  phone?: string;
  isOpen: boolean;
}

export default function MerchantQRPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);

  const merchantId = params.id as string;

  useEffect(() => {
    const fetchMerchant = async () => {
      try {
        // If viewing own merchant page, use profile
        if (user?.merchantProfile?.id === merchantId) {
          const profile = await api.getMerchantProfile();
          setMerchant({
            id: profile.id,
            businessName: profile.businessName,
            address: profile.address,
            phone: user.phone,
            isOpen: true,
          });
        } else {
          // Otherwise try to fetch by ID (for admin or public view)
          setMerchant({
            id: merchantId,
            businessName: 'Mi Negocio',
            address: 'Nicoya, Guanacaste',
            isOpen: true,
          });
        }
      } catch (error) {
        console.error('Failed to fetch merchant:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchant();
  }, [merchantId, user]);

  if (loading || authLoading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-4xl"
        >
          Clock
        </motion.div>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl mb-4 block">X</span>
          <p className="text-surface-500 dark:text-surface-400">Comercio no encontrado</p>
          <Link href="/dashboard" className="mt-4 inline-block text-kiwi-600 hover:text-kiwi-700">
            ← Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
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
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Mi Código QR
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-8">
        {/* QR Code Card */}
        <motion.div
          className="rounded-3xl bg-white dark:bg-surface-800 p-8 shadow-soft dark:shadow-dark mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="text-center mb-6">
            <motion.div
              className="text-5xl mb-3"
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              
            </motion.div>
            <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
              {merchant.businessName}
            </h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              {merchant.address}
            </p>
          </div>

          <QRCodeGenerator
            merchantId={merchantId}
            businessName={merchant.businessName}
            size={280}
            showActions={true}
            branded={true}
          />
        </motion.div>

        {/* Instructions */}
        <motion.div
          className="rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            ClipboardList ¿Cómo usar tu QR?
          </h3>
          <div className="space-y-4">
            {[
              {
                step: '1',
                icon: 'Printer',
                title: 'Imprime el QR',
                desc: 'Descarga o imprime el código y ponlo en un lugar visible de tu negocio',
              },
              {
                step: '2',
                icon: 'Smartphone',
                title: 'Cliente escanea',
                desc: 'El cliente apunta su cámara al código QR con su teléfono',
              },
              {
                step: '3',
                icon: 'ClipboardList',
                title: 'Ve el menú',
                desc: 'Se abre tu menú digital con todos tus productos y precios',
              },
              {
                step: '4',
                icon: 'ShoppingCart',
                title: 'Cliente pide',
                desc: 'El cliente selecciona sus productos y paga directamente desde el celular',
              },
              {
                step: '5',
                icon: 'Bike',
                title: 'Repartidor recoge',
                desc: 'Recibes la comanda en tu sistema y un repartidor la lleva al cliente',
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kiwi-500 text-white text-sm font-bold flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">
                    {item.icon} {item.title}
                  </p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Tips */}
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            💡 Consejos para tu QR
          </h3>
          <ul className="space-y-3 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              Pon el QR en la mesa, en la caja, o en la puerta de entrada
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              Asegúrate de que esté bien iluminado para fácil escaneo
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              Imprime varios códigos si tienes múltiples mesas
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              Puedes pegarlo en paredes, vidrieras o mostradores
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              Actualiza tu menú cuando cambies precios o productos
            </li>
          </ul>
        </motion.div>
      </main>
    </div>
  );
}
