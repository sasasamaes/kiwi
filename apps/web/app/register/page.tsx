// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AuthForm, useAuth, api } from '@kiwi/ui';

/** Banner del link de invitación (?email=&invitation=). Nulo = sin invitación. */
function InvitationBanner({ state }: { state: 'valid' | 'invalid' | null }) {
  if (!state) return null;
  return (
    <div
      role="status"
      className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
        state === 'valid'
          ? 'border-kiwi-200 bg-kiwi-50 text-kiwi-700'
          : 'border-amber-300 bg-amber-50 text-amber-800'
      }`}
    >
      {state === 'valid'
        ? '🥝 Te invitaron a sumar tu comercio a Kiwi — completá el registro con este correo.'
        : 'Ese link de invitación venció o no es válido. Podés registrarte igual.'}
    </div>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link del correo del admin: /register?email=…&invitation=…
  const invitedEmail = searchParams.get('email') ?? '';
  const invitationToken = searchParams.get('invitation') ?? '';
  const [inviteState, setInviteState] = useState<'valid' | 'invalid' | null>(null);

  useEffect(() => {
    if (!invitationToken) return;
    let alive = true;
    api
      .validateInvitation(invitationToken, invitedEmail || undefined, 'merchant')
      .then((r) => {
        if (alive) setInviteState(r?.valid ? 'valid' : 'invalid');
      })
      .catch(() => {
        if (alive) setInviteState(null);
      });
    return () => {
      alive = false;
    };
  }, [invitationToken, invitedEmail]);

  const handleSubmit = async (data: any) => {
    setLoading(true);
    setError(null);

    try {
      // Don't send blank optionals: backend regex-validates phone when present.
      const payload: Record<string, unknown> = {
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: 'merchant',
      };
      if (data.phone?.trim()) payload.phone = data.phone.trim();
      if (data.businessName?.trim()) payload.businessName = data.businessName.trim();
      if (invitationToken) payload.invitationToken = invitationToken;
      await register(payload);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <InvitationBanner state={inviteState} />
      <AuthForm
        type="register"
        role="merchant"
        initialEmail={invitedEmail}
        onSubmit={handleSubmit}
        onToggle={() => router.push('/login')}
        loading={loading}
        error={error || undefined}
      />
    </>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-kiwi-50 via-white to-kiwi-100 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 flex flex-col">
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
      <main id="main-content" className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <Suspense fallback={null}>
            <RegisterForm />
          </Suspense>
        </div>
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
