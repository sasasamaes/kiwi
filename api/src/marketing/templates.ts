// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.

/**
 * Plantillas informativas: qué es Kiwi y cómo funciona, una por app. El admin
 * las edita antes de enviar; {{registerUrl}} se reemplaza por el link de
 * registro de esa app y {{name}} por el nombre si se conoce.
 */
export interface InfoTemplate {
  id: string;
  role: 'merchant' | 'driver' | 'customer';
  label: string;
  subject: string;
  body: string;
}

export const INFO_TEMPLATES: InfoTemplate[] = [
  {
    id: 'how-merchant',
    role: 'merchant',
    label: 'Cómo funciona Kiwi Comercio',
    subject: 'Cómo funciona Kiwi para tu comercio 🥝',
    body: [
      'Hola {{name}},',
      '',
      'Kiwi es la app de delivery de tu ciudad. Así funciona para tu comercio:',
      '',
      '1. Publicás tu menú con fotos desde tu teléfono.',
      '2. Recibís los pedidos en vivo y los preparás.',
      '3. Un repartidor los recoge y los entrega; vos solo cobrás.',
      '4. Aceptás efectivo, SINPE y tarjeta. Sin alquiler ni mensualidad: solo una comisión por pedido entregado.',
      '',
      'Creá tu cuenta acá: {{registerUrl}}',
      '',
      'Si querés que te lo expliquemos en persona en tu local, respondé este mensaje.',
    ].join('\n'),
  },
  {
    id: 'how-driver',
    role: 'driver',
    label: 'Cómo funciona Kiwi Repartidores',
    subject: 'Cómo funciona repartir con Kiwi 🛵',
    body: [
      'Hola {{name}},',
      '',
      'Repartir con Kiwi es así:',
      '',
      '1. Te registrás y verificás tu identidad (KYC).',
      '2. Te ponés en línea cuando quieras trabajar.',
      '3. Aceptás los pedidos que te convengan y seguís la ruta.',
      '4. Cobrás tus ganancias por SINPE o transferencia.',
      '',
      'Empezá acá: {{registerUrl}}',
      '',
      'Dudas? Respondé este mensaje y te ayudamos.',
    ].join('\n'),
  },
  {
    id: 'how-customer',
    role: 'customer',
    label: 'Cómo funciona Kiwi para pedir',
    subject: 'Pedí tu comida favorita con Kiwi 🥝',
    body: [
      'Hola {{name}},',
      '',
      'Kiwi junta los comercios de tu ciudad en una sola app:',
      '',
      '1. Elegís qué comer y pedís en 1 tap.',
      '2. Pagás en efectivo, SINPE, tarjeta o crypto.',
      '3. Seguís tu pedido en vivo hasta tu puerta.',
      '',
      'Creá tu cuenta acá: {{registerUrl}}',
    ].join('\n'),
  },
];
