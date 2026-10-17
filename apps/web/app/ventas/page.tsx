// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Playbook de ventas KIWI (interno) — server component (el contenido no
 * viaja como props serializadas y la clave nunca llega al cliente).
 * Protegido por middleware server-side (apps/web/middleware.ts):
 *  - `?key=<VENTAS_ACCESS_KEY>` → cookie httpOnly (30 días) con el hash de la
 *    clave y redirect a la URL limpia.
 *  - Cookie válida → pasa.
 *  - Sin autorización → el middleware reescribe a /acceso-ventas y el
 *    contenido jamás sale del servidor.
 * La clave vive solo en el servidor (VENTAS_ACCESS_KEY); el cliente nunca la
 * ve. Todos (incluido el admin) usan la misma clave de equipo.
 */

import Link from 'next/link';
import {
  Lock,
  Store,
  Bike,
  Package,
  Footprints,
  MessageCircle,
  MessageSquare,
  Handshake,
  Smartphone,
  Timer,
  TrendingUp,
  Wallet,
  MapPin,
  Calculator,
  BadgeCheck,
  Search,
  CalendarCheck,
  FlaskConical,
  Rocket,
  LifeBuoy,
  FileText,
  Info,
  AlertTriangle,
  Target,
} from 'lucide-react';

const icps = [
  {
    icon: Store,
    title: 'Soda / restaurante de barrio',
    traits: [
      'Dueño-operador, 1–15 empleados, casco de Nicoya (₡1.000–₡1.500)',
      'Vende por mostrador y WhatsApp: pedidos a mano, entregas "cuando se pueda"',
      'Dolor: pedidos perdidos, entregas tardías, sin moto propia',
    ],
    meta: 'Menú promedio ₡8.000 · Decisión: días · Visita presencial + WhatsApp',
  },
  {
    icon: Bike,
    title: 'Repartidor independiente',
    traits: [
      'Moto propia, ya hace mandados por ₡500–₡1.500',
      'Dolor: viajes inconstantes, cobra tarde, sin visibilidad de demanda',
      'Propuesta: flujo diario de viajes, payout claro, retiros semanales',
    ],
    meta: 'Paga la comisión — convéncelo con números: ₡1.275 por viaje de ₡1.500',
  },
  {
    icon: Package,
    title: 'Encomiendas / abarrotes (expansión)',
    traits: [
      'Farmacias, ferreterías, librerías que mandan paquetes lejos (₡2.000–₡7.000)',
      'Dolor: depender de taxistas, sin tracking ni comprobante',
      'Propuesta: encomienda con peso (₡500/kg extra) y tracking público',
    ],
    meta: 'Ticket por zona lejana · Decisión: 1–2 semanas · WhatsApp',
  },
];

const valorComercio = [
  {
    icon: Wallet,
    title: '₡0 fijo, 0% comisión',
    text: 'Te quedás con el 100% de tus productos. Nosotros ganamos por el viaje, no por tu comida.',
  },
  {
    icon: MessageSquare,
    title: 'Pedidos ordenados',
    text: 'Nada se pierde en el chat: menú, carrito y estados en vivo desde la app.',
  },
  {
    icon: Bike,
    title: 'Reparto sin duele',
    text: 'No administras motos ni repartidores; Kiwi lo hace con tarifas de zona claras.',
  },
  {
    icon: MapPin,
    title: 'Tracking y marca',
    text: 'Tus clientes ven el pedido llegar en vivo, con tu nombre en la app.',
  },
];

const valorDriver = [
  {
    icon: TrendingUp,
    title: 'Demanda constante',
    text: 'Viajes todos los días sin perseguirlos: asignación automática y propuestas.',
  },
  {
    icon: BadgeCheck,
    title: 'Números claros',
    text: 'Ves tu payout antes de aceptar el viaje (tarifa − 15%). Retiros semanales.',
  },
  {
    icon: Smartphone,
    title: 'Herramienta de ruta',
    text: 'Mapa, detección de zona, navegación e historial de ganancias en la app.',
  },
];

const canales = [
  {
    icon: Footprints,
    title: 'Visita presencial (principal)',
    items: [
      'Ruta de sodas del casco: 10 visitas/semana',
      'Demo en vivo desde el teléfono del dueño',
      'Dejar su menú cargado en la visita: probar cuesta ₡0',
    ],
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp comercial',
    items: [
      'Seguimiento de visitas y onboarding con fotos',
      'Grupo de comercios Kiwi (novedades + soporte)',
      'El 90% de la operación local ya vive ahí: es obligatorio estar',
    ],
  },
  {
    icon: Handshake,
    title: 'Partnerships',
    items: [
      'Cámara de Comercio y Turismo de Nicoya',
      'Distribuidoras de insumos: referido cruzado',
      'Repartidores activos referen comercios (+₡ por activación)',
    ],
  },
  {
    icon: Smartphone,
    title: 'Digital (soporte)',
    items: [
      'Landing + Instagram con entregas reales',
      'Reseñas de comercios activos',
      'No es canal de cierre aún: alimenta confianza',
    ],
  },
];

const proceso = [
  {
    icon: Search,
    title: 'Prospección',
    text: 'Ruta física por barrio + directorio de la Cámara. Calificar: ¿vende a domicilio?, ¿cómo entrega hoy?, ¿cuántos pedidos/día? Todo a la hoja comercial.',
  },
  {
    icon: CalendarCheck,
    title: 'Visita / contacto',
    text: 'Demo de 15 min en su mostrador: cargar su menú en vivo y hacer un pedido de prueba. Ver su comida "en la app" es lo que vende.',
  },
  {
    icon: FlaskConical,
    title: 'Piloto (1–2 semanas)',
    text: '100% gratis, sin exclusividad. KPI: pedidos captados + entregas a tiempo. Sin volumen → analizar precio del menú, fotos o zona.',
  },
  {
    icon: Rocket,
    title: 'Cierre',
    text: 'Menú completo con fotos, horarios, capacitación de 30 min. Acuerdo simple: 0% comisión, cambios con aviso de 30 días.',
  },
  {
    icon: Bike,
    title: 'Onboarding de repartidores',
    text: 'En paralelo: 15 activos para 100 viajes/día. Venderles con números: ₡1.275 por viaje de ₡1.500, 7 viajes al día.',
  },
  {
    icon: LifeBuoy,
    title: 'Operación y retención',
    text: 'Revisión mensual: pedidos, productos top, horarios pico. Churn se ataca revisando zona/menú, nunca con descuentos.',
  },
];

const objeciones = [
  {
    q: '“¿Cuánto me cuesta?” (comercio)',
    a: 'Hoy, nada. Cero mensualidad y cero comisión: te quedás con el 100% de tu menú. Nuestro ingreso viene del viaje, no de tu comida. Si mañana el modelo cambia, se conversa con 30 días de aviso — la idea es que vender más te sirva a vos.',
  },
  {
    q: '“Ya tengo un chico que reparte.”',
    a: 'Perfecto, usémoslo: en Kiwi él recibe los viajes como repartidor y usted ve todo en la app. Su gente no se cambia — solo se ordena. Y si algún día necesita más moto, ahí estamos.',
  },
  {
    q: '“La app es muy complicada para mi gente.”',
    a: 'El pedido lo hace el cliente desde su celular; usted solo escucha el beep y aprieta "aceptar". La capacitación son 30 minutos y dejamos un QR en caja. Si su cajera usa WhatsApp, usa Kiwi.',
  },
  {
    q: '“15% es mucho para el repartidor.”',
    a: 'Mirá los números: viaje de ₡1.500, te quedan ₡1.275; en el centro hay 7–10 viajes por hora pico. Las tarifas por zona ya subieron para compensar: las lejanas pagan ₡2.500–₡7.000. Y diciembre + verano son los mejores meses.',
  },
  {
    q: '“¿Y si la entrega sale mal?”',
    a: 'Cada pedido tiene tracking, estados y registro completo. Hay soporte por WhatsApp. El objetivo es que nunca tengas que pedir disculpas por una entrega.',
  },
  {
    q: '“Déjame pensarlo.”',
    a: 'Claro. ¿Qué es lo que más le frena: la app, las entregas o el menú? Le propongo: piloto de 2 semanas, gratis, con 5 productos. Si no vendés nada por Kiwi, lo cerramos ahí. ¿Arrancamos el lunes?',
  },
];

const precios = [
  { concepto: 'Registro del comercio', precio: '₡0', quien: 'Comercio' },
  { concepto: 'Comisión sobre productos', precio: '0% (fase actual)', quien: 'Comercio' },
  { concepto: 'Suscripción / mensualidad', precio: '₡0', quien: 'Comercio' },
  {
    concepto: 'Comisión de plataforma por viaje',
    precio: '15% (configurable por admin)',
    quien: 'Repartidor',
  },
  {
    concepto: 'Tarifa de entrega por zona',
    precio: '₡1.000 – ₡7.000 (catálogo público)',
    quien: 'Cliente',
  },
  { concepto: 'Encomiendas', precio: '₡500/kg extra después de 5 kg', quien: 'Cliente' },
  {
    concepto: 'Pago digital',
    precio: 'fee de pasarela ~2,9%',
    quien: 'Comercio (solo tarjeta/SINPE web)',
  },
];

const kpisProceso = [
  { k: '10+', v: 'Visitas a comercios/semana' },
  { k: '≥5', v: 'Comercios en piloto activo' },
  { k: '≥60%', v: 'Conversión piloto → activo' },
  { k: '15', v: 'Repartidores activados' },
];

const kpisResultado = [
  { k: '100', v: 'Viajes/día (mínimo; +30% en temporada)' },
  { k: '₡1.200–₡2.000', v: 'Viaje promedio efectivo (mezcla real)' },
  { k: '>90%', v: 'Pedidos con delivery_zone bien clasificada' },
  { k: '~54', v: 'Viajes/día = punto de equilibrio (simulador)' },
];

const hitos = [
  { mes: 'Mes 1', meta: '10 comercios piloto · 5 repartidores · 20 viajes/día' },
  {
    mes: 'Mes 3',
    meta: '25 comercios activos · 12 repartidores · 60 viajes/día · punto de equilibrio operativo',
  },
  {
    mes: 'Mes 6',
    meta: '40 comercios · 18 repartidores · 100+ viajes/día · evaluación fase 2 (productos) con datos reales',
  },
];

function Section({
  n,
  id,
  title,
  icon: Icon,
  children,
}: {
  n: number;
  id: string;
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-5">
        <span className="h-9 w-9 shrink-0 rounded-xl bg-kiwi-600 text-white font-bold flex items-center justify-center">
          {n}
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-surface-800 dark:text-surface-100 flex items-center gap-2">
          <Icon className="h-5 w-5 text-kiwi-700 dark:text-kiwi-400" />
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Playbook() {
  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 text-surface-700 dark:text-surface-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-12">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold">
                <Lock className="h-3.5 w-3.5" />
                Confidencial — Fuerza de Ventas
              </span>
            </div>
            <Link href="/" className="text-sm text-kiwi-700 dark:text-kiwi-400 hover:underline">
              ← Kiwi
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-surface-900 dark:text-white">
            Plan de Ventas <span className="text-kiwi-700 dark:text-kiwi-400">KIWI</span>
          </h1>
          <p className="text-base sm:text-lg">
            Estrategia, guía operativa, guiones y manejo de objeciones. Este documento es la
            referencia única del equipo comercial en Nicoya. Vendemos valor:{' '}
            <strong className="text-surface-800 dark:text-surface-100">
              el comercio no paga comisión hoy
            </strong>{' '}
            — el repartidor paga 15% por viaje y el cliente paga productos + tarifa de zona.
          </p>
          <div className="flex items-start gap-2 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              <strong>Política de precios:</strong> comercio con ₡0 de mensualidad y 0% de comisión
              sobre productos. Repartidor paga <strong>15% del viaje</strong> (guardada por pedido;
              si el admin la cambia, solo afecta pedidos nuevos). Cliente paga{' '}
              <strong>productos + tarifa de zona</strong> (₡1.000–₡7.000). Sin descuentos: el precio
              público es el precio. Pasarela ~2,9% solo en cobros digitales.
            </p>
          </div>
        </header>

        {/* 1. ICP */}
        <Section n={1} id="icp" title="ICP y Mercado Objetivo" icon={Target}>
          <div className="grid gap-4 sm:grid-cols-3">
            {icps.map((i) => (
              <div
                key={i.title}
                className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4 space-y-3"
              >
                <i.icon className="h-6 w-6 text-kiwi-700 dark:text-kiwi-400" />
                <h3 className="font-semibold text-surface-800 dark:text-surface-100">{i.title}</h3>
                <ul className="text-sm space-y-1.5 list-disc list-inside">
                  {i.traits.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <p className="text-xs text-surface-500 dark:text-surface-400 border-t border-surface-100 dark:border-surface-800 pt-2">
                  {i.meta}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { k: '~45.000', v: 'hab. en el cantón de Nicoya' },
              { k: '150+', v: 'sodas y restaurantes activos' },
              { k: '+30%', v: 'demanda en temporada (dic–abr, jul)' },
            ].map((s) => (
              <div key={s.v} className="rounded-xl bg-surface-100 dark:bg-surface-800/60 p-3">
                <p className="text-lg font-bold text-kiwi-700 dark:text-kiwi-300">{s.k}</p>
                <p className="text-[11px] text-surface-500 dark:text-surface-400">{s.v}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 2. Propuesta de valor */}
        <Section n={2} id="valor" title="Propuesta de Valor" icon={TrendingUp}>
          <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">Al comercio</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {valorComercio.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4"
              >
                <v.icon className="h-5 w-5 text-kiwi-700 dark:text-kiwi-400 mb-2" />
                <p className="font-semibold text-surface-800 dark:text-surface-100">{v.title}</p>
                <p className="text-sm">{v.text}</p>
              </div>
            ))}
          </div>
          <h3 className="font-semibold text-surface-800 dark:text-surface-100 mt-6 mb-3">
            Al repartidor
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {valorDriver.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4"
              >
                <v.icon className="h-5 w-5 text-kiwi-700 dark:text-kiwi-400 mb-2" />
                <p className="font-semibold text-surface-800 dark:text-surface-100">{v.title}</p>
                <p className="text-sm">{v.text}</p>
              </div>
            ))}
          </div>
          <blockquote className="mt-6 rounded-2xl border-l-4 border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/20 p-4 text-sm italic text-kiwi-900 dark:text-kiwi-100">
            “Kiwi le vende por app a su soda: sus clientes piden solo, la entrega sale con tarifa
            fija por zona, y usted recibe el 100% de su comida — hoy sin mensualidad ni comisión.
            Solo queremos que vender sea fácil y que la entrega no sea su problema.”
          </blockquote>
        </Section>

        {/* 3. Canales */}
        <Section n={3} id="canales" title="Canales de Venta" icon={Footprints}>
          <div className="grid gap-4 sm:grid-cols-2">
            {canales.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4"
              >
                <c.icon className="h-5 w-5 text-kiwi-700 dark:text-kiwi-400 mb-2" />
                <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-2">
                  {c.title}
                </h3>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {c.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* 4. Proceso */}
        <Section n={4} id="proceso" title="Proceso de Venta" icon={CalendarCheck}>
          <ol className="space-y-3">
            {proceso.map((p, idx) => (
              <li
                key={p.title}
                className="flex gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4"
              >
                <span className="h-8 w-8 shrink-0 rounded-full bg-kiwi-100 dark:bg-kiwi-900/40 text-kiwi-700 dark:text-kiwi-300 font-bold flex items-center justify-center text-sm">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-semibold text-surface-800 dark:text-surface-100 flex items-center gap-2">
                    <p.icon className="h-4 w-4 text-kiwi-700 dark:text-kiwi-400" />
                    {p.title}
                  </p>
                  <p className="text-sm">{p.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* 5. Guiones */}
        <Section n={5} id="guiones" title="Guiones de Venta" icon={MessageSquare}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4">
              <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-2">
                5.1 · Visita a comercio (apertura)
              </h3>
              <blockquote className="text-sm italic border-l-2 border-kiwi-400 pl-3">
                “Buenas, soy [Nombre] de Kiwi. Le hago una pregunta rápida: cuando alguien le llama
                por WhatsApp para pedir, ¿quién toma el pedido y quién lo lleva?”
                <br />
                <span className="not-italic text-surface-500 dark:text-surface-400">
                  (escuchar: cuaderno, chofer informal, nadie)
                </span>
                <br />
                “Justo eso resolvemos. Kiwi es la app de entregas de Nicoya: su menú adentro,
                pedidos que no se pierden y la entrega con tarifa fija por zona — a usted hoy le
                cuesta ₡0. Se lo muestro en su teléfono en 10 minutos, ¿va?”
              </blockquote>
            </div>
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4">
              <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-2">
                5.2 · Seguimiento post-visita (24–48 h)
              </h3>
              <blockquote className="text-sm italic border-l-2 border-kiwi-400 pl-3">
                “Don [Nombre], ¿cómo le fue con la app? Vi que ya cargó X productos — le falta solo
                la foto de 2 para que se vea bien. Esta semana llevamos pedidos de sodas en
                [barrio]. ¿Le parece que arranquemos el piloto el lunes sin costo?”
              </blockquote>
            </div>
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4">
              <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-2">
                5.3 · Reclutamiento de repartidor
              </h3>
              <blockquote className="text-sm italic border-l-2 border-kiwi-400 pl-3">
                “¿Hacés mandados en moto? Kiwi te da viajes todos los días sin andar buscándolos. Un
                viaje de ₡1.500 te deja ₡1.275 — el 15% es la comisión de la plataforma. Se retira
                cada semana. Con 7 viajes al día son unas ₡255.000 al mes. ¿Te lo muestro en 10
                minutos?”
              </blockquote>
            </div>

            <h3 className="font-semibold text-surface-800 dark:text-surface-100 pt-2">
              5.4 · Objeciones frecuentes
            </h3>
            <div className="space-y-2">
              {objeciones.map((o) => (
                <details
                  key={o.q}
                  className="group rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4"
                >
                  <summary className="cursor-pointer font-medium text-surface-800 dark:text-surface-100 marker:content-none flex items-center justify-between gap-2">
                    {o.q}
                    <span className="text-kiwi-700 group-open:rotate-180 transition-transform">
                      ▾
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-kiwi-800 dark:text-kiwi-200 bg-kiwi-50 dark:bg-kiwi-900/20 rounded-xl p-3">
                    {o.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </Section>

        {/* 6. Precios */}
        <Section n={6} id="precios" title="Precios (lo que se puede decir)" icon={Wallet}>
          <div className="overflow-x-auto rounded-2xl border border-surface-200 dark:border-surface-700">
            <table className="w-full text-sm">
              <thead className="bg-surface-100 dark:bg-surface-800 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-surface-700 dark:text-surface-200">
                    Concepto
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-surface-700 dark:text-surface-200">
                    Precio
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-surface-700 dark:text-surface-200">
                    Quién paga
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-surface-900 divide-y divide-surface-100 dark:divide-surface-800">
                {precios.map((p) => (
                  <tr key={p.concepto}>
                    <td className="px-4 py-2.5 text-surface-700 dark:text-surface-200">
                      {p.concepto}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-kiwi-700 dark:text-kiwi-300">
                      {p.precio}
                    </td>
                    <td className="px-4 py-2.5">{p.quien}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Regla de oro: no prometer descuentos ni "atar" la comisión del repartidor verbalmente —
            esa tasa la administra el dueño y se comunica oficialmente. Exclusividad o precio
            especial → escalar al dueño.
          </p>
        </Section>

        {/* 7. KPIs */}
        <Section n={7} id="kpis" title="KPIs Comerciales" icon={Target}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4">
              <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
                Proceso (semanal)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {kpisProceso.map((s) => (
                  <div key={s.v} className="rounded-xl bg-surface-50 dark:bg-surface-800/60 p-3">
                    <p className="text-xl font-bold text-kiwi-700 dark:text-kiwi-300">{s.k}</p>
                    <p className="text-[11px] text-surface-500 dark:text-surface-400">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4">
              <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
                Resultado (mensual)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {kpisResultado.map((s) => (
                  <div key={s.v} className="rounded-xl bg-surface-50 dark:bg-surface-800/60 p-3">
                    <p className="text-lg font-bold text-kiwi-700 dark:text-kiwi-300">{s.k}</p>
                    <p className="text-[11px] text-surface-500 dark:text-surface-400">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {hitos.map((h) => (
              <div
                key={h.mes}
                className="flex gap-3 items-center rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3"
              >
                <span className="text-sm font-bold text-kiwi-700 dark:text-kiwi-300 w-14 shrink-0">
                  {h.mes}
                </span>
                <span className="text-sm">{h.meta}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 8. Material */}
        <Section n={8} id="material" title="Material de Apoyo" icon={FileText}>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Calculator className="h-4 w-4 mt-0.5 text-kiwi-700 dark:text-kiwi-400 shrink-0" />
              <span>
                <Link
                  href="/admin/simulador"
                  className="font-medium text-kiwi-700 dark:text-kiwi-300 hover:underline"
                >
                  Simulador de ganancias
                </Link>{' '}
                — proyecciones con tarifas reales, punto de equilibrio, comparación de escenarios y{' '}
                <strong>exportar PNG</strong> para mandar por WhatsApp al prospecto.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-kiwi-700 dark:text-kiwi-400 shrink-0" />
              <span>
                <strong>Catálogo de zonas</strong> con precios públicos (₡1.000–₡7.000): la tarifa
                que ve el cliente nunca se negocia zona por zona.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-kiwi-700 dark:text-kiwi-400 shrink-0" />
              <span>
                <strong>Link de tracking público</strong>: demostrarlo en cada visita (es el "wow").
              </span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="h-4 w-4 mt-0.5 text-kiwi-700 dark:text-kiwi-400 shrink-0" />
              <span>
                <Link
                  href="/ventas/acuerdo-comercio"
                  className="font-medium text-kiwi-700 dark:text-kiwi-300 hover:underline"
                >
                  Acuerdo simple de comercio
                </Link>{' '}
                (1 página imprimible) y{' '}
                <Link
                  href="/ventas/one-pager-repartidor"
                  className="font-medium text-kiwi-700 dark:text-kiwi-300 hover:underline"
                >
                  one-pager de repartidor
                </Link>
                : listos para imprimir en la visita o mandar como PDF.
              </span>
            </li>
          </ul>
        </Section>

        {/* 9. Ejecución */}
        <Section n={9} id="ejecucion" title="Ejecución" icon={Timer}>
          <p className="text-sm">
            Este plan se revisa <strong>cada 2 semanas</strong> con datos reales del panel admin
            (pedidos, platformFee, zonas). Todo contacto, piloto y objeción se registra. Lo que no
            se mide, no se mejora.
          </p>
          <blockquote className="mt-4 rounded-2xl bg-kiwi-600 text-white p-5 text-center font-semibold">
            Vendemos valor, no descuentos. El comercio entra gratis porque la plataforma hace crecer
            su venta; el repartidor se queda porque los números le funcionan; el cliente vuelve
            porque la tarifa es justa y la entrega llega.
          </blockquote>
        </Section>

        <footer className="pt-4 pb-10 text-center text-xs text-surface-500 dark:text-surface-400 border-t border-surface-200 dark:border-surface-800">
          KIWI · Nicoya, Costa Rica — Documento interno de ventas. No distribuir.
        </footer>
      </div>
    </main>
  );
}

export default function VentasPage() {
  // El middleware ya autorizó (cookie httpOnly); aquí solo se renderiza.
  return <Playbook />;
}
