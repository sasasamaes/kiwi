// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Términos — Kiwi',
  description:
    'Términos de uso de Kiwi: pedidos, precios, pagos, envíos y uso aceptable de la plataforma.',
};

export default function TermsPage() {
  return <LegalDocView doc="terms" />;
}
