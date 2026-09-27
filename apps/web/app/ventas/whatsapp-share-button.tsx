// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';

/**
 * Botón de WhatsApp (client): arma el link wa.me post-mount con la URL real
 * (evita mismatch de hidratación y no serializa nada sensible).
 */
export function WhatsAppShareButton() {
  const [waHref, setWaHref] = useState('');

  useEffect(() => {
    const shareUrl = window.location.href;
    const text = [
      '🥝 ¿Hacés mandados en moto en Nicoya?',
      '',
      'Con Kiwi tenés viajes todos los días sin andar buscándolos:',
      '• Un viaje de ₡1.500 te deja ₡1.275 (el 85% es tuyo)',
      '• 7–10 viajes por hora pico en el centro',
      '• Con 7 viajes al día son unas ₡255.000 al mes',
      '• Retiro de ganancias cada semana',
      '',
      `Mirá los números, la tabla por zona y los requisitos acá: ${shareUrl}`,
    ].join('\n');
    setWaHref(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }, []);

  return (
    <a
      href={waHref || '#'}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={!waHref}
      title="Abre WhatsApp con el mensaje listo para enviar"
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors ${
        waHref ? 'bg-[#25D366] hover:bg-[#1fbf5a]' : 'bg-[#25D366]/50 pointer-events-none'
      }`}
    >
      <MessageCircle className="h-4 w-4" />
      WhatsApp
    </a>
  );
}
