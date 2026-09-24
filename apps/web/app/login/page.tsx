'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AuthForm, useAuth } from '@kiwi/ui';

/** Destino post-login según rol: el admin va a su panel, no al dashboard. */
function homeForRole(role?: string): string {
  return role === 'admin' ? '/admin' : '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading } = useAuth();
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ya logueado y cae en /login: mandar a su home (ej. admin → /admin).
  useEffect(() => {
    if (!loading && user) {
      router.replace(homeForRole((user as any).role));
    }
  }, [user, loading, router]);

  const handleSubmit = async (data: any) => {
    setFormLoading(true);
    setError(null);

    try {
      const loggedUser = await login(data.email, data.password);
      router.push(homeForRole((loggedUser as any)?.role));
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión. Intenta de nuevo.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-kiwi-50 via-white to-kiwi-100 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 flex flex-col">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-kiwi-200/30"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-kiwi-300/20"
          animate={{ scale: [1.2, 1, 1.2], rotate: [360, 180, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gold-200/20"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
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
      <main id="main-content" className="relative z-10 flex-1 flex items-center justify-center p-4">
        <AuthForm
          type="login"
          role="merchant"
          onSubmit={handleSubmit}
          onToggle={() => router.push('/register')}
          loading={formLoading}
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
          Al iniciar sesión, aceptas nuestros{' '}
          <a href="/terms" className="text-kiwi-700 hover:underline">
            Términos
          </a>{' '}
          y{' '}
          <a href="/privacy" className="text-kiwi-700 hover:underline">
            Privacidad
          </a>
        </p>
      </motion.footer>
    </div>
  );
}
