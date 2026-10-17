// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { PrintButton } from '../print-button';

/**
 * Acuerdo simple de comercio — 1 página imprimible.
 * Herramienta de venta: se llena en el teléfono/laptop en la visita, se
 * imprime (o manda a PDF con Ctrl+P) y se firma en el mostrador.
 */

const clausulas = [
  {
    t: '1. Servicio',
    d: 'Kiwi pone a disposición del COMERCIO la plataforma digital para recibir pedidos a domicilio y coordinar su entrega dentro de las zonas del catálogo vigente. La tarifa de entrega la paga el CLIENTE según el catálogo público por zona (₡1.000 a ₡7.000), el cual no es negociable por pedido.',
  },
  {
    t: '2. Costo para el comercio (fase actual)',
    d: 'Cero mensualidad y cero comisión sobre el valor de los productos: el COMERCIO recibe el 100% del valor de su menú. Kiwi obtiene sus ingresos de la comisión por viaje que paga el repartidor (15% del viaje). Kiwi podrá modificar estas condiciones con 30 días de aviso previo por escrito (WhatsApp o correo con confirmación de lectura).',
  },
  {
    t: '3. Pedidos y entrega',
    d: 'El COMERCIO se compromete a confirmar los pedidos en la app dentro de los tiempos normales de preparación y a entregar el pedido completo al repartidor. La entrega a domicilio la realiza el repartidor asignado por la plataforma; el COMERCIO no contrata ni administra repartidores.',
  },
  {
    t: '4. Pagos',
    d: 'El CLIENTE paga productos + tarifa de zona. Si el pago es en efectivo, el COMERCIO recibe el total del cliente menos la tarifa de zona que corresponde al repartidor. Si el pago es digital (tarjeta/SINPE web), el COMERCIO recibe el 100% de los productos; el fee de pasarela (~2,9%) corre por cuenta del COMERCIO.',
  },
  {
    t: '5. Menú y precios',
    d: 'El COMERCIO es el único responsable de su menú, precios, fotos y disponibilidad, y de mantenerlos actualizados en la app. Los precios publicados en la app obligan al COMERCIO, salvo error notorio notificado de inmediato.',
  },
  {
    t: '6. Cancelaciones',
    d: 'Las cancelaciones del COMERCIO sin justa causa después de aceptar el pedido afectan la calidad del servicio y serán motivo de revisión del acuerdo. Cancelación del CLIENTE antes del envío no genera costo para ninguna de las partes.',
  },
  {
    t: '7. Vigencia y salida',
    d: 'Vigencia indefinida. Cualquiera de las partes puede terminar sin penalidad con aviso de 15 días. Al terminar, el COMERCIO conserva su clientela y Kiwi elimina los datos del menú a petición.',
  },
  {
    t: '8. Daños y garantías',
    d: 'La calidad del producto es responsabilidad exclusiva del COMERCIO. La puntualidad y el estado del viaje son responsabilidad de Kiwi y sus repartidores. Ninguna parte responde por daño indirecto; el alcance máximo de responsabilidad es el valor del pedido en cuestión.',
  },
];

function Field({ label, width = 'w-40' }: { label: string; width?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <strong className="font-semibold">{label}</strong>
      <span
        className={`${width} inline-block border-b border-dotted border-surface-400 print:border-surface-600`}
      >
        &nbsp;
      </span>
    </span>
  );
}

export default function AcuerdoComercioPage() {
  return (
    <div className="min-h-[100dvh] bg-surface-100 dark:bg-surface-950 print:bg-white py-8 print:py-0">
      {/* Barra de acciones (no se imprime) */}
      <div className="max-w-[820px] mx-auto px-4 mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <a href="/ventas" className="text-sm text-kiwi-700 dark:text-kiwi-300 hover:underline">
          ← Plan de ventas
        </a>
        <PrintButton />
      </div>

      {/* Documento */}
      <div className="max-w-[820px] mx-auto px-4 print:px-0">
        <div className="bg-white text-surface-800 rounded-2xl shadow-sm print:shadow-none print:rounded-none p-6 sm:p-10 print:p-0">
          {/* Encabezado */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-kiwi-600 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-surface-900">
                🥝 Kiwi — Acuerdo Simple de Comercio
              </h1>
              <p className="text-sm text-surface-500 mt-1">
                Servicio de pedidos y entregas por zona · Nicoya, Costa Rica
              </p>
            </div>
            <div className="text-sm text-right">
              <p className="font-semibold">Fecha:</p>
              <span className="border-b border-dotted border-surface-400 px-8">
                {new Date().toLocaleDateString('es-CR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Partes */}
          <p className="text-sm leading-7 mb-6">
            Entre <Field label="Nombre del propietario:" width="w-48" />{' '}
            <Field label="cédula:" width="w-28" />, representante legal de{' '}
            <Field label="Negocio:" width="w-40" /> (en adelante el <strong>COMERCIO</strong>), con
            teléfono <Field label="WhatsApp:" width="w-28" />, y <strong>KIWI</strong> (plataforma
            de pedidos y entregas de Nicoya), acuerdan lo siguiente:
          </p>

          {/* Datos editables ocultos al imprimir (se escriben a mano si se desea) */}

          {/* Cláusulas */}
          <ol className="space-y-3 text-sm leading-6">
            {clausulas.map((c) => (
              <li key={c.t}>
                <strong>{c.t}.</strong> {c.d}
              </li>
            ))}
          </ol>

          {/* Cierre */}
          <p className="text-sm mt-6">Leído y acordado, las partes firman:</p>
          <div className="grid grid-cols-2 gap-8 mt-10 print:mt-12">
            <div>
              <div className="border-t border-surface-600 pt-1 text-xs text-surface-500">
                Firma del COMERCIO
              </div>
            </div>
            <div>
              <div className="border-t border-surface-600 pt-1 text-xs text-surface-500">
                Firma y sello KIWI
              </div>
            </div>
          </div>

          <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-8 border-t pt-3">
            Documento de inténto de negocio simplificado, no constituye un contrato mercantil
            formal. Cualquier disputa se resuelve de buena fe entre las partes. Vigencia de
            condiciones según la versión publicada por Kiwi en la fecha de firma.
          </p>
        </div>
      </div>
    </div>
  );
}
