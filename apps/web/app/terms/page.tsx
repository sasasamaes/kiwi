import Link from 'next/link';

export const metadata = {
  title: 'Términos — Kiwi',
  description: 'Términos de uso de Kiwi.',
};

export default function TermsPage() {
  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/" className="text-sm text-kiwi-600 hover:underline">
          ← Volver
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-surface-900 dark:text-surface-50">
          Términos de uso
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          <p>
            Kiwi conecta comercios, repartidores independientes y compradores. El comercio es
            responsable de los productos; el repartidor, del traslado; Kiwi, de la plataforma.
          </p>
          <p>
            Los precios y tiempos estimados se calculan por el servidor al crear el pedido; el
            tiempo de entrega mostrado es una estimación con tráfico, no una garantía.
          </p>
          <p>
            El pago en línea se completa con el proveedor de pagos. Si el pago no se confirma, el
            pedido puede coordinarse contra entrega por los canales del comercio.
          </p>
          <p>El mal uso (spam, fraude, manipulación de estados) puede suspender la cuenta.</p>
        </div>
      </div>
    </main>
  );
}
