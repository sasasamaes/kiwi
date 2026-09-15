'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Star, Loader2, CheckCircle2, Bike, PackageCheck, Clock, ShieldCheck } from 'lucide-react';
import { api, Skeleton, AnimatedButton } from '@kiwi/ui';

interface OrderInfo {
  id: string;
  status: string;
  merchant?: { businessName: string };
  driver?: { id: string; fullName: string; rating: number; vehicleType: string };
}

const RATING_LABELS: Record<number, { title: string; emoji: string }> = {
  1: { title: 'Muy malo', emoji: '😠' },
  2: { title: 'Malo', emoji: '🙁' },
  3: { title: 'Normal', emoji: '😐' },
  4: { title: 'Bueno', emoji: '🙂' },
  5: { title: '¡Excelente!', emoji: '🤩' },
};

export default function RateOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stars, setStars] = useState(0);
  const [onTime, setOnTime] = useState<boolean | null>(null);
  const [careful, setCareful] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const data = await api.getOrderById(orderId);
      setOrder(data);
      // ¿Ya fue calificado? El backend decide quién puede calificar.
      const ratingInfo = await api.getRatingForOrder(orderId);
      if (ratingInfo.rating) {
        setDone(true);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch order:', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el pedido');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  async function handleSubmit() {
    if (stars === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.submitRating({
        orderId,
        rating: stars,
        comment: comment.trim() || undefined,
        onTime: onTime ?? undefined,
        carefulWithOrder: careful ?? undefined,
      });
      setDone(true);
    } catch (err) {
      console.error('Failed to submit rating:', err);
      setSubmitError(err instanceof Error ? err.message : 'No se pudo enviar la calificación');
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Estados de carga / error ----------

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 p-4 pt-20">
        <div className="mx-auto max-w-md space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex flex-col items-center justify-center p-4 text-center">
        <p className="text-surface-600 dark:text-surface-400 mb-4">
          {error || 'Pedido no encontrado'}
        </p>
        <Link href="/orders" className="text-kiwi-600 dark:text-kiwi-400 font-medium underline">
          Volver a mis pedidos
        </Link>
      </div>
    );
  }

  // ---------- Ya calificado ----------

  if (done) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex flex-col items-center justify-center p-4 text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <CheckCircle2 className="h-16 w-16 text-kiwi-500 mb-4" />
        </motion.div>
        <h1 className="font-display text-2xl font-bold text-surface-800 dark:text-surface-100 mb-2">
          ¡Gracias por calificar!
        </h1>
        <p className="text-surface-500 dark:text-surface-400 mb-6">
          Tu opinión ayuda a mejorar el servicio.
        </p>
        <div className="flex gap-3">
          <Link
            href="/orders"
            className="rounded-xl px-5 py-3 font-medium bg-surface-200 dark:bg-surface-700 text-surface-800 dark:text-surface-100"
          >
            Mis pedidos
          </Link>
          <Link
            href={`/order/${orderId}/tracking`}
            className="rounded-xl px-5 py-3 font-medium bg-kiwi-gradient text-white"
          >
            Ver el pedido
          </Link>
        </div>
      </div>
    );
  }

  // ---------- Solo pedidos entregados se pueden calificar ----------

  if (order.status !== 'delivered') {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex flex-col items-center justify-center p-4 text-center">
        <p className="text-4xl mb-3">🚚</p>
        <p className="text-surface-600 dark:text-surface-400 mb-4">
          Podrás calificar este pedido cuando sea entregado.
        </p>
        <Link
          href={`/order/${orderId}/tracking`}
          className="rounded-xl px-5 py-3 font-medium bg-kiwi-gradient text-white"
        >
          Ver el seguimiento
        </Link>
      </div>
    );
  }

  // ---------- Formulario ----------

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 p-4 pb-36">
      <div className="mx-auto max-w-md">
        <button
          onClick={() => router.back()}
          className="flex min-h-[44px] items-center gap-2 text-surface-600 dark:text-surface-400 mb-6"
        >
          ← Volver
        </button>

        <div className="text-center mb-8">
          <p className="text-4xl mb-2">🎉</p>
          <h1 className="font-display text-2xl font-bold text-surface-800 dark:text-surface-100">
            ¿Cómo estuvo tu entrega?
          </h1>
          {order.merchant?.businessName && (
            <p className="text-surface-500 dark:text-surface-400 mt-1">
              Pedido de {order.merchant.businessName}
            </p>
          )}
        </div>

        {/* Repartidor */}
        {order.driver && (
          <div className="mb-6 rounded-2xl glass p-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-kiwi-gradient text-white font-bold text-xl">
              {order.driver.fullName?.charAt(0) || 'D'}
            </div>
            <div>
              <p className="font-semibold text-surface-800 dark:text-surface-100">
                {order.driver.fullName}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" />
                {order.driver.rating?.toFixed(1) || '5.0'} · calificación actual
              </p>
            </div>
          </div>
        )}

        {/* Estrellas */}
        <div className="mb-8">
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((value) => (
              <motion.button
                key={value}
                whileTap={{ scale: 0.85 }}
                onClick={() => setStars(value)}
                aria-label={`${value} estrellas`}
                className="focus:outline-none"
              >
                <Star
                  className={`h-11 w-11 transition-colors ${
                    value <= stars
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-surface-300 dark:text-surface-600'
                  }`}
                />
              </motion.button>
            ))}
          </div>
          <p className="mt-3 text-center text-sm font-medium text-surface-600 dark:text-surface-400 h-6">
            {stars > 0 ? `${RATING_LABELS[stars].emoji} ${RATING_LABELS[stars].title}` : ''}
          </p>
        </div>

        {/* Etiquetas rápidas (solo con estrellas elegidas) */}
        {stars > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 mb-8"
          >
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                <Clock className="h-4 w-4" /> ¿Llegó a tiempo?
              </p>
              <div className="flex gap-2">
                {[
                  { value: true, label: 'Sí, puntual' },
                  { value: false, label: 'Se demoró' },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setOnTime(opt.value)}
                    className={`flex-1 rounded-xl border p-3 text-sm font-medium transition-colors ${
                      onTime === opt.value
                        ? 'border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-300'
                        : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                <PackageCheck className="h-4 w-4" /> ¿Trató bien el paquete?
              </p>
              <div className="flex gap-2">
                {[
                  { value: true, label: 'Sí, impecable' },
                  { value: false, label: 'Con descuidos' },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setCareful(opt.value)}
                    className={`flex-1 rounded-xl border p-3 text-sm font-medium transition-colors ${
                      careful === opt.value
                        ? 'border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-300'
                        : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                <ShieldCheck className="h-4 w-4" /> Comentario (opcional)
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Cuéntanos algo sobre la entrega…"
                className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-3 text-sm text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
              <p className="mt-1 text-right text-xs text-surface-400">{comment.length}/500</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Barra inferior fija */}
      <div className="pb-safe fixed bottom-0 inset-x-0 bg-surface-50 dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700 p-4">
        <div className="mx-auto max-w-md">
          <AnimatedButton
            onClick={handleSubmit}
            disabled={stars === 0 || submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-kiwi-gradient py-4 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Enviando…
              </>
            ) : stars === 0 ? (
              'Elige una calificación'
            ) : (
              'Enviar calificación'
            )}
          </AnimatedButton>
          {submitError && <p className="mt-2 text-center text-sm text-red-500">{submitError}</p>}
        </div>
      </div>
    </div>
  );
}
