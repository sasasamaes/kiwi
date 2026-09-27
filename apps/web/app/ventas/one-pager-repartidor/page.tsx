// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { PrintButton } from '../print-button';
import { WhatsAppShareButton } from '../whatsapp-share-button';

/**
 * One-pager de reclutamiento de repartidor — imprimible.
 * Se entrega impreso en la visita o se manda por WhatsApp como PDF.
 * Los números salen del modelo real: tarifa de zona del catálogo − 15%.
 */

const zonas = [
  { label: 'Centro, Carmen, Santa Lucía, Cananga, Virginia, Cementerio', precio: '₡1.000' },
  {
    label: 'Matabuey, Aeropuerto, Caimito, Los Ángeles, La Granja, San Martín',
    precio: '₡1.500',
  },
  { label: 'Casitas, Del cruce pa afuera, Bosques afuera', precio: '₡2.000' },
  { label: 'Curime, Bosques adentro', precio: '₡2.500' },
  { label: 'Llano, Reserva Curime', precio: '₡3.000' },
  { label: 'Nambi', precio: '₡3.500' },
  { label: 'Monte Galán, Moracia, Caimital', precio: '₡5.000' },
  { label: 'Mansión', precio: '₡6.000' },
  { label: 'Hojancha', precio: '₡7.000' },
];

const requisitos = [
  'Moto propia con papeles al día y licencia vigente',
  'Teléfono smartphone con datos móviles (la app es la herramienta de trabajo)',
  'Cédula de identidad y número de cuenta IBAN o SINPE para retiros',
  'Verificación KYC de la plataforma (gratis, se hace una vez en la app)',
];

export default function OnePagerDriverPage() {
  return (
    <div className="min-h-[100dvh] bg-surface-100 dark:bg-surface-950 print:bg-white py-8 print:py-0">
      {/* Barra de acciones (no se imprime) */}
      <div className="max-w-[820px] mx-auto px-4 mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <a href="/ventas" className="text-sm text-kiwi-700 dark:text-kiwi-300 hover:underline">
          ← Plan de ventas
        </a>
        <div className="flex items-center gap-2">
          <WhatsAppShareButton />
          <PrintButton />
        </div>
      </div>

      {/* Documento */}
      <div className="max-w-[820px] mx-auto px-4 print:px-0">
        <div className="bg-white text-surface-800 rounded-2xl shadow-sm print:shadow-none print:rounded-none p-6 sm:p-10 print:p-0">
          {/* Encabezado con banda de marca */}
          <div className="rounded-xl bg-gradient-to-r from-kiwi-700 to-kiwi-800 text-white px-6 py-5 mb-6 print:rounded-lg">
            <h1 className="text-2xl font-bold">🥝 Repartí con Kiwi</h1>
            <p className="text-sm text-white/90 mt-1">
              Viajes todos los días en Nicoya · Payout claro por zona · Retiro semanal
            </p>
          </div>

          {/* La promesa central */}
          <div className="grid grid-cols-3 gap-3 text-center mb-6">
            {[
              { k: '₡1.275', v: 'tu pago por un viaje de ₡1.500 (te queda el 85%)' },
              { k: '7–10', v: 'viajes por hora pico en el centro de Nicoya' },
              { k: '~₡255.000', v: 'al mes con 7 viajes al día (estimado)' },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border-2 border-kiwi-600 p-3">
                <p className="text-xl font-bold text-kiwi-700">{s.k}</p>
                <p className="text-[11px] text-surface-500 mt-0.5 leading-tight">{s.v}</p>
              </div>
            ))}
          </div>

          {/* Cómo funciona */}
          <h2 className="font-bold text-surface-900 mb-2">¿Cómo funciona?</h2>
          <ol className="text-sm leading-6 list-decimal list-inside space-y-1 mb-6">
            <li>Te registrás en la app de repartidor y pasás la verificación (una vez).</li>
            <li>Te conectás cuando querés trabajar: la app te muestra los viajes disponibles.</li>
            <li>
              Ves el <strong>pago exacto antes de aceptar</strong> (tarifa de zona menos el 15% de
              comisión de la plataforma) y decidís.
            </li>
            <li>Recogés, entregás, y el pago se acumula en tu app.</li>
            <li>Retirás tus ganancias cada semana a tu cuenta o SINPE.</li>
          </ol>

          {/* Tabla de pagos por zona */}
          <h2 className="font-bold text-surface-900 mb-2">Lo que te paga cada viaje</h2>
          <table className="w-full text-sm border border-surface-200 rounded-lg overflow-hidden mb-2">
            <thead className="bg-surface-100 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Zona de entrega</th>
                <th className="px-3 py-2 font-semibold w-28">Tarifa cliente</th>
                <th className="px-3 py-2 font-semibold w-24">Tú recibís</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {zonas.map((z) => {
                const precio = Number(z.precio.replace('₡', '').replace('.', ''));
                return (
                  <tr key={z.label}>
                    <td className="px-3 py-1.5">{z.label}</td>
                    <td className="px-3 py-1.5">{z.precio}</td>
                    <td className="px-3 py-1.5 font-semibold text-kiwi-700">
                      ₡{Math.round(precio * 0.85).toLocaleString('es-CR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-surface-400 mb-6">
            Comisión de plataforma: 15% del viaje. Las encomiendas pagan ₡500 por kilo extra después
            de 5 kg, y ese extra también suma a tu pago.
          </p>

          {/* Requisitos + contacto */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h2 className="font-bold text-surface-900 mb-2">Requisitos</h2>
              <ul className="text-sm leading-6 list-disc list-inside space-y-1">
                {requisitos.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-kiwi-50 border border-kiwi-200 p-4 self-start">
              <h2 className="font-bold text-kiwi-800 mb-1">Empezá hoy</h2>
              <p className="text-sm text-kiwi-900 leading-6">
                Escribinos por WhatsApp al <strong>[teléfono Kiwi]</strong> o descargá la app de
                repartidor y registrate. La verificación tarda menos de un día.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-surface-400 mt-8 border-t pt-3">
            Los montos son estimados basados en la tarifa vigente por zona y el 15% de comisión; el
            pago real de cada viaje se muestra en la app antes de aceptarlo. La demanda varía por
            horario y temporada. Kiwi · Nicoya, Costa Rica.
          </p>
        </div>
      </div>
    </div>
  );
}
