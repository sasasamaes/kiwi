'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AuthForm, useAuth } from '@kiwi/ui';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: any) => {
    setLoading(true);
    setError(null);

    try {
      await register({
        email: data.email,
        password: data.password,
        phone: data.phone,
        fullName: data.fullName,
        role: 'merchant',
        businessName: data.businessName,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-kiwi-50 via-white to-kiwi-100 flex flex-col">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-kiwi-200/30"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-kiwi-300/20"
          animate={{ scale: [1.2, 1, 1.2], rotate: [360, 180, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Header */}
      <motion.header
        className="relative z-10 p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-surface-600 hover:text-surface-800"
        >
          <span>←</span>
          <span className="text-sm font-medium">Volver</span>
        </Link>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <AuthForm
          type="register"
          role="merchant"
          onSubmit={handleSubmit}
          onToggle={() => router.push('/login')}
          loading={loading}
          error={error || undefined}
        />
      </main>

      {/* Footer */}
      <motion.footer
        className="relative z-10 p-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p className="text-xs text-surface-400">
          Al registrarte, aceptas nuestros{' '}
          <a href="#" className="text-kiwi-600 hover:underline">
            Términos
          </a>{' '}
          y{' '}
          <a href="#" className="text-kiwi-600 hover:underline">
            Privacidad
          </a>
        </p>
      </motion.footer>
    </div>
  );
}
