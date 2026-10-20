// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Datos oficiales del negocio Kiwi — única fuente de verdad.
 * Cambian aquí y se propagan a landing, documentos legales y contacto.
 * (No duplicar estos valores en otros archivos: importar desde '@kiwi/ui'.)
 */
export const business = {
  name: 'Kiwi',
  /** Figura legal. Persona física: completar el nombre del titular aquí
   *  si se desea publicarlo en los documentos legales. */
  legalEntity:
    'operado por su titular como persona física (sin cédula jurídica), con domicilio en Nicoya, Guanacaste, Costa Rica',
  email: 'contacto@kiwicr.express',
  phone: '+506 8826 4007',
  /** Número sin espacios para enlaces tel:/wa.me. */
  phoneDial: '+50688264007',
  whatsapp: 'https://wa.me/50688264007',
  instagram: {
    handle: '@kiwi_cr_express',
    url: 'https://www.instagram.com/kiwi_cr_express/',
  },
  location: 'Nicoya, Guanacaste, Costa Rica',
} as const;

export type BusinessInfo = typeof business;
