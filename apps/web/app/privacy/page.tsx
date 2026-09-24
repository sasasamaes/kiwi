import Link from 'next/link';

export const metadata = {
  title: 'Privacidad — Kiwi',
  description: 'Cómo Kiwi trata tus datos.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/" className="text-sm text-kiwi-600 hover:underline">
          ← Volver
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-surface-900 dark:text-surface-50">
          Política de privacidad
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          <p>
            Kiwi pide solo los datos necesarios para operar el delivery: nombre, teléfono,
            direcciones de entrega y ubicación del repartidor durante el viaje.
          </p>
          <p>
            El link de seguimiento es público para quien lo tenga (el UUID del pedido es la
            credencial): muestra estado, mapa y datos del repartidor, nunca teléfonos ni correos de
            terceros.
          </p>
          <p>
            No vendemos datos. Los pagos con tarjeta/SINPE los procesa OnvoPay; Kiwi nunca ve ni
            guarda números de tarjeta.
          </p>
          <p>
            Para ejercer acceso, rectificación o eliminación escribinos por los canales de soporte
            de la app.
          </p>
        </div>
      </div>
    </main>
  );
}
