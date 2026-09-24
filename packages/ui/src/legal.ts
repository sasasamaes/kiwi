/**
 * Contenido legal de Kiwi — fuente única compartida por las 4 superficies
 * (web comercio, driver, client QR y mobile) vía `LegalDocView`.
 *
 * Redactado para la realidad del producto (datos que efectivamente maneja
 * el schema de Prisma): pedidos de invitados, KYC de repartidores/comercios,
 * ubicación de repartidores, link de tracking público y pagos vía OnvoPay.
 *
 * ⚠️ Mantener en español neutro-voseo (es-CR) y sin promesas que el producto
 * no cumpla. Antes de publicar en producción: revisión legal profesional.
 */

import { business } from './business';

export type LegalDocKind = 'privacy' | 'terms' | 'cookies' | 'refunds';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  /** Filas opcionales de tabla (p. ej. inventario de cookies). */
  table?: { headers: string[]; rows: string[][] };
}

export interface LegalDoc {
  title: string;
  /** Fecha de última actualización en formato ISO (YYYY-MM-DD). */
  updated: string;
  intro: string[];
  sections: LegalSection[];
  /** Nota de contacto al pie del documento. */
  contactNote: string;
}

export const privacyPolicy: LegalDoc = {
  title: 'Política de privacidad',
  updated: '2026-09-24',
  intro: [
    'Kiwi es la plataforma que conecta comercios, repartidores independientes y clientes en Nicoya, Guanacaste, Costa Rica. Esta política explica qué datos personales recopilamos, para qué los usamos, con quién los compartimos y cómo ejercer tus derechos. Aplica al menú QR del cliente, al panel del comercio y a la app del repartidor.',
  ],
  sections: [
    {
      heading: 'Quién es responsable de tus datos',
      paragraphs: [
        `Kiwi es ${business.legalEntity}. Para cualquier tema de privacidad escribí a ${business.email} o escribinos por WhatsApp al ${business.phone}.`,
      ],
    },
    {
      heading: 'Minimización: solo lo necesario',
      paragraphs: [
        'Recopilamos la menor cantidad de datos posible para operar el servicio. Pedidos sin cuenta: solo nombre, teléfono y dirección de esa entrega. Comercios: no te pedimos nombre personal — la cuenta funciona con el nombre de tu negocio. Repartidores: nombre y documentos porque son tu identificación pública y legal ante comercios y clientes.',
        'En diagnósticos técnicos (errores reportados a Sentry) identificamos usuarios solo por un identificador interno, nunca por email o nombre, y los detalles de pedidos se redactan antes de salir de nuestros servidores.',
      ],
    },
    {
      heading: 'Qué datos recopilamos',
      paragraphs: [
        'Datos del pedido (clientes, con o sin cuenta): nombre, número de teléfono, dirección de entrega, zona y notas del pedido. Se usan únicamente para tomar y entregar tu pedido.',
        'Datos de cuenta: si creás cuenta como comercio o repartidor, guardamos tu correo o teléfono y una contraseña cifrada (nunca en texto plano).',
        'Datos del negocio (comercios): nombre, dirección, ubicación del local, logo, descripción y horarios, que se muestran públicamente en tu menú QR.',
        'Datos del repartidor: nombre, foto, tipo de vehículo, placa, nivel y calificación. Tu ubicación se usa para asignar envíos y, durante un viaje, para mostrarle al cliente en el mapa por dónde va el pedido. Guardamos la última ubicación conocida para alertas de tráfico por zona.',
        'Documentos de verificación (KYC): cédula (frente y reverso), selfie, licencia de conducir, registro vehicular y seguro del repartidor; licencia o documentos comerciales del comercio. Solo sirven para verificar tu identidad y habilitar tu cuenta; los revisa el equipo de Kiwi y no se muestran a otros usuarios.',
        'Datos de pago: los cobros con tarjeta y SINPE Móvil los procesa OnvoPay, nuestro proveedor de pagos. Kiwi nunca ve ni guarda el número de tu tarjeta. De los pagos en criptomonedas registramos la moneda, la wallet, la red y el hash de la transacción. El efectivo se registra como método de pago del pedido.',
      ],
    },
    {
      heading: 'Datos técnicos',
      paragraphs: [
        'Para que las notificaciones de pedidos lleguen a tiempo usamos Firebase Cloud Messaging, que almacena un identificador del dispositivo.',
        'Registramos errores técnicos y métricas de uso de la plataforma (con herramientas como Sentry) para detectar fallas y mejorar el servicio.',
        'La app del repartidor guarda datos de trabajo en tu propio dispositivo para funcionar sin internet y los sincroniza cuando volvés a tener conexión.',
      ],
    },
    {
      heading: 'Con quién compartimos tus datos',
      paragraphs: [
        'No vendemos datos personales. Nunca.',
        'En cada pedido participan tres partes: tu nombre, teléfono y dirección se comparten con el comercio (para preparar el pedido) y con el repartidor asignado (para entregarlo). Solo durante ese pedido.',
        'El link de seguimiento de un pedido es público para quien lo tenga: muestra estado, mapa y datos del repartidor, pero nunca teléfonos ni datos de contacto de terceros. Tratalo como una credencial.',
        'Proveedores que nos ayudan a operar: OnvoPay (pagos), Firebase (notificaciones), Sentry (monitoreo de errores) y proveedores de hosting.',
        'Servicios de mapas: para sugerir direcciones y calcular rutas usamos Nominatim y OSRM (proyectos abiertos de OpenStreetMap). Estas búsquedas se hacen desde nuestros servidores con la dirección parcialmente procesada y no incluyen tu nombre ni teléfono; los mapas que ves se cargan desde tiles de OpenStreetMap.',
        'Datos a autoridades únicamente cuando una ley o resolución judicial lo exija.',
      ],
    },
    {
      heading: 'Cuánto tiempo conservamos tus datos',
      paragraphs: [
        'Los datos de pedidos se conservan para tu historial, el soporte y la contabilidad de cada parte.',
        'Los documentos KYC se conservan mientras tu cuenta esté activa; si la cerrás, se eliminan o anonimizan, salvo que la ley obligue a conservarlos más tiempo.',
        'Los datos técnicos de errores se conservan por plazos cortos, solo mientras sirven para diagnosticar.',
      ],
    },
    {
      heading: 'Tus derechos',
      paragraphs: [
        `Podés solicitar acceso, rectificación o eliminación de tus datos personales, escribiendo a ${business.email} desde el teléfono o correo asociado a tu cuenta. Respondemos en un plazo razonable y sin costo. También podés acudir a la Defensoría de los Habitantes (prodhabi), que vela por la protección de datos personales en Costa Rica.`,
        'Los clientes que pidieron sin cuenta pueden pedir que eliminemos el teléfono y la dirección de un pedido, salvo los datos que debamos conservar por razones contables.',
        'Si tu cuenta es de comercio o repartidor y tiene pagos o retiros asociados, debemos conservar ciertos datos por obligaciones legales y fiscales aunque la cuenta se cierre.',
      ],
    },
    {
      heading: 'Menores de edad',
      paragraphs: [
        'Kiwi no está dirigida a menores de 18 años. Los repartidores deben ser mayores de edad y presentar documentación vigente. Si detectamos una cuenta de un menor, la desactivamos.',
      ],
    },
    {
      heading: 'Cookies y almacenamiento local',
      paragraphs: [
        'Kiwi guarda en tu navegador solo lo necesario para tu sesión y preferencias (detalle completo en nuestra política de cookies). La analítica opcional queda apagada hasta que la aceptes desde el aviso de cookies.',
      ],
    },
    {
      heading: 'Cambios en esta política',
      paragraphs: [
        'Si cambiamos algo importante, publicamos la versión actualizada en esta página con nueva fecha de vigencia. Cuando un cambio afecte tus derechos, te avisamos también dentro de la app.',
      ],
    },
  ],
  contactNote: `¿Dudas sobre esta política? Escribinos a ${business.email} o al WhatsApp ${business.phone}`,
};

export const cookiePolicy: LegalDoc = {
  title: 'Política de cookies y almacenamiento local',
  updated: '2026-09-23',
  intro: [
    'Kiwi usa almacenamiento local del navegador (localStorage, caché offline y cookies estrictamente necesarias) para mantener tu sesión, recordar tus preferencias y que la app del repartidor funcione sin internet. No usamos cookies publicitarias ni de rastreo de terceros.',
  ],
  sections: [
    {
      heading: 'Qué usamos y para qué',
      paragraphs: [
        'Sesión: tu token de acceso se guarda para que no tengas que iniciar sesión en cada recarga. Al cerrar sesión se elimina.',
        'Preferencias: tema claro/oscuro, idioma y sonido de notificaciones se guardan para respetar cómo configuraste la app.',
        'Dispositivo: un identificador aleatorio por dispositivo para sincronizar datos offline sin asociarlos a tu persona.',
        'Caché offline: en la app del repartidor se guardan localmente pedidos, rutas y datos de trabajo para operar sin conexión; se sincronizan y limpian al reconectar.',
      ],
      table: {
        headers: ['Clave', 'Tipo', 'Para qué sirve', 'Duración'],
        rows: [
          [
            'kiwi_token',
            'localStorage',
            'Mantener tu sesión iniciada (token JWT)',
            'Hasta cerrar sesión',
          ],
          ['kiwi-theme', 'localStorage', 'Recordar tu tema claro/oscuro', '12 meses'],
          ['kiwi-locale', 'localStorage', 'Recordar tu idioma preferido', '12 meses'],
          [
            'kiwi_sound_enabled',
            'localStorage',
            'Recordar si activaste el sonido de notificaciones',
            '12 meses',
          ],
          [
            'kiwi-device-id',
            'localStorage',
            'Identificar el dispositivo para sync offline',
            'Hasta borrar datos del navegador',
          ],
          [
            'Cache del service worker',
            'Cache Storage',
            'Funcionamiento offline de la app (PWA)',
            'Se actualiza automáticamente',
          ],
          [
            'Datos offline del repartidor',
            'IndexedDB',
            'Pedidos y rutas sin conexión; se sincronizan al reconectar',
            'Se limpia al sincronizar',
          ],
        ],
      },
    },
    {
      heading: 'Analítica y diagnóstico (con tu consentimiento)',
      paragraphs: [
        'Si aceptás, usamos PostHog para entender cómo se usa la plataforma (qué pantallas se visitan, dónde se traba un flujo). Guarda un identificador anónimo en tu navegador y no lo asociamos a tu persona.',
        'Los errores técnicos se reportan a Sentry para poder arreglar fallas; esos reportes van sin identidad y con datos sensibles eliminados, y funcionan aunque elijas “Solo necesarias” porque no perfilan ni rastrean.',
        'La grabación de sesión para depurar errores (session replay) está apagada por defecto y solo corre si aceptaste la analítica.',
        'La analítica no se activa hasta que presionás “Aceptar” en el aviso de cookies. Si elegís “Solo necesarias”, ningún evento de uso sale de tu dispositivo.',
        'Podés cambiar de opinión cuando quieras con el enlace “Cookies” al pie de la página.',
      ],
    },
    {
      heading: 'Cookies de terceros',
      paragraphs: [
        'Los pagos con tarjeta y SINPE se procesan en la pasarela de OnvoPay, que puede usar sus propias cookies durante el cobro para proteger la transacción. Kiwi no las controla.',
        'No incorporamos bots de redes sociales ni píxeles publicitarios.',
      ],
    },
    {
      heading: 'Cómo controlar o borrar el almacenamiento',
      paragraphs: [
        'Desde tu navegador podés borrar los datos del sitio en cualquier momento (Configuración → Privacidad → Borrar datos de navegación). Si borrás “kiwi_token”, simplemente tenés que iniciar sesión de nuevo.',
        'El aviso de cookies te permite aceptar solo lo estrictamente necesario o la analítica, y cambiar esa decisión después.',
      ],
    },
  ],
  contactNote: `¿Dudas sobre esta política? Escribinos a ${business.email} o al WhatsApp ${business.phone}`,
};

export const refundPolicy: LegalDoc = {
  title: 'Política de reembolsos y cancelaciones',
  updated: '2026-09-24',
  intro: [
    'Esta política explica cuándo y cómo se cancela un pedido en Kiwi y cómo se devuelve tu dinero. Aplica a clientes (con o sin cuenta), comercios y pagos procesados por la plataforma.',
  ],
  sections: [
    {
      heading: 'Cancelar un pedido',
      paragraphs: [
        'Como cliente, contactá al comercio lo antes posible (o a soporte con tu número de pedido). El comercio puede cancelar tu pedido mientras el repartidor no haya salido por él.',
        'Antes de confirmar, la app te muestra el desglose del total (productos y envío), y estos términos y esta política están disponibles en todo momento desde la app.',
        'Una vez que el repartidor recogió el pedido, ya no se puede cancelar: está en camino y el envío está comprometido.',
        'Si el comercio cancela porque se agotó un producto o no puede preparar tu pedido, recibís el reembolso completo sin excepción.',
      ],
    },
    {
      heading: 'Cómo recibís tu dinero según el método de pago',
      paragraphs: [
        'Tarjeta o SINPE Móvil (OnvoPay): el reembolso vuelve por el mismo medio de pago que usaste. Lo procesa la pasarela; tu banco puede tardar típicamente entre 5 y 10 días hábiles en reflejarlo.',
        'Efectivo: como pagás al recibir, una cancelación a tiempo simplemente significa que no pagás. Si ya pagaste y hubo un error, el comercio te devuelve el efectivo directamente.',
        'Criptomonedas (USDC/USDT): caso por caso vía soporte; la devolución se hace a la wallet de origen por el monto acordado.',
        'Crédito de comercio: si tu pedido se pagó con saldo prepago de la cuenta del comercio, el saldo se restituye automáticamente y queda registrado en el historial de créditos.',
      ],
    },
    {
      heading: 'Producto incorrecto, incompleto o en mal estado',
      paragraphs: [
        'Contactá al comercio de inmediato, o escribinos a soporte con tu número de pedido. Según el caso corresponde reembolso total o parcial del producto; si el error fue del comercio, el reembolso incluye el costo de envío.',
        'Kiwi facilita la comunicación y garantiza que el reembolso acordado se ejecute por el mismo medio de pago.',
      ],
    },
    {
      heading: 'Qué no es reembolsable',
      paragraphs: [
        'Pedidos entregados y aceptados sin reclamo oportuno, salvo defectos que no se pudieron notar al recibir.',
        'El costo de envío de pedidos entregados correctamente (salvo que el error fuera del comercio).',
        'Cancelaciones cuando el repartidor ya recogió el pedido.',
        'Sobre el derecho de retracto: la ley costarricense (artículo 44 de la Ley 7472) da 8 días hábiles para retractarse de compras a distancia, pero lo excluye expresamente para bienes perecederos, como la comida preparada. Aun así, en Kiwi podés cancelar sin costo mientras el repartidor no haya salido — más favorable que el mínimo legal. Los productos defectuosos se cubren por la vía de garantía (artículos 52 y 102 de la misma ley).',
      ],
    },
    {
      heading: 'Cómo pedir un reembolso',
      paragraphs: [
        `Tené a mano tu número de pedido (los últimos 8 caracteres que aparecen en tu pantalla de seguimiento, por ejemplo #A1B2C3D4). Escribí al comercio o a ${business.email} y respondemos en un plazo razonable, normalmente dentro del mismo día.`,
        'Si el pedido se pagó por la plataforma, Kiwi verifica el estado del pago y ejecuta el reembolso directamente; no dependemos de que el comercio lo gestione manualmente.',
        'Si no llegamos a un acuerdo, podés acudir a la Dirección de Apoyo al Consumidor del Ministerio de Economía, Industria y Comercio (MEIC).',
      ],
    },
    {
      heading: 'Cambios en esta política',
      paragraphs: ['Publicamos cualquier cambio en esta página con nueva fecha de vigencia.'],
    },
  ],
  contactNote: `¿Dudas sobre un reembolso? Escribinos a ${business.email} con tu número de pedido`,
};

export const termsOfService: LegalDoc = {
  title: 'Términos de uso',
  updated: '2026-09-23',
  intro: [
    'Estos términos regulan el uso de Kiwi, la plataforma que conecta comercios, repartidores independientes y clientes en Nicoya, Costa Rica. Al usar cualquier parte de Kiwi aceptás estos términos.',
  ],
  sections: [
    {
      heading: 'Qué es (y qué no es) Kiwi',
      paragraphs: [
        `Kiwi es ${business.legalEntity}. Contacto: ${business.email} · WhatsApp ${business.phone} · Instagram ${business.instagram.handle}.`,
        'Kiwi es un intermediario tecnológico: recibe tu pedido, lo transmite al comercio y coordina el envío con repartidores independientes. El comercio es responsable de la calidad y preparación de los productos; el repartidor, del traslado; Kiwi, del funcionamiento de la plataforma.',
      ],
    },
    {
      heading: 'Cuentas',
      paragraphs: [
        'Debés dar información verídica y mantenerla actualizada. Las cuentas de comercio y repartidor pasan por verificación de identidad (KYC) antes de activarse.',
        'Podés cerrar tu cuenta cuando quieras. Kiwi puede suspender cuentas por fraude, abuso o incumplimiento de estos términos.',
      ],
    },
    {
      heading: 'Pedidos, precios y pagos',
      paragraphs: [
        'Los precios están en colones (₡) y los define cada comercio. El total (productos + envío) se calcula al confirmar el pedido. Aceptamos efectivo, SINPE Móvil, tarjeta y criptomonedas (USDC/USDT en Stellar), según disponibilidad.',
        'Si un producto se agota o hay un error de precio manifiesto, el comercio te contactará para resolverlo antes de preparar el pedido.',
        'Reembolsos por el producto: se coordinan con el comercio; Kiwi facilita el contacto y, de ser necesario, la devolución por el mismo medio de pago. Detalle completo en nuestra política de reembolsos.',
      ],
    },
    {
      heading: 'Envíos',
      paragraphs: [
        'Los tiempos de entrega son estimaciones que consideran preparación, distancia y tráfico; no son una garantía. El costo de envío depende de la zona de entrega.',
        'Si no hay nadie para recibir en la dirección indicada, el repartidor intentará contactarte; si no es posible entregar, el pedido puede cancelarse.',
      ],
    },
    {
      heading: 'Repartidores',
      paragraphs: [
        'Los repartidores son trabajadores independientes, no empleados de Kiwi. Deben tener licencia y documentación vehicular vigentes, respetar las normas de tránsito y tratar con respeto a comercios y clientes. Las calificaciones determinan su nivel y acceso a pedidos.',
      ],
    },
    {
      heading: 'Uso aceptable',
      paragraphs: [
        'Está prohibido: suplantar identidades, manipular el estado de pedidos, abusar del sistema de pagos o reembolsos, acosar a repartidores, comercios o clientes, y usar la plataforma para actividad ilícita.',
      ],
    },
    {
      heading: 'Propiedad intelectual y contenido',
      paragraphs: [
        'La plataforma Kiwi (software, diseño, marca y textos) pertenece a su titular. Está prohibido copiar, modificar o redistribuirla sin autorización.',
        'Los logotipos, fotos de productos, foto de perfil, menús y descripciones pertenecen a quien los sube (comercio o repartidor). Al subirlos, nos das permiso para mostrarlos dentro de Kiwi mientras tu cuenta esté activa; garantizás que tenés derecho a usarlos.',
        'Los mapas usan datos de OpenStreetMap, disponibles bajo la Open Database License (© colaboradores de OpenStreetMap).',
        `Si creés que algún contenido infringe tus derechos, escribinos a ${business.email} indicando el material y tu reclamo; lo revisaremos y retiraremos lo que corresponda.`,
      ],
    },
    {
      heading: 'Limitación de responsabilidad',
      paragraphs: [
        'Kiwi se ofrece "tal cual" y "según disponibilidad". En la máxima medida permitida por la ley, Kiwi no responde por daños indirectos o lucro cesante. Nada en estos términos limita responsabilidades que la ley costarricense no permita limitar.',
      ],
    },
    {
      heading: 'Cambios y ley aplicable',
      paragraphs: [
        'Podemos actualizar estos términos; la versión vigente se publica siempre en esta página. Se rigen por las leyes de Costa Rica y cualquier controversia se somete a los tribunales competentes de Nicoya, Guanacaste. Como consumidor, también podés acudir a la Dirección de Apoyo al Consumidor del Ministerio de Economía, Industria y Comercio (MEIC).',
      ],
    },
  ],
  contactNote: `¿Dudas sobre estos términos? Escribinos a ${business.email}`,
};
