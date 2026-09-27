// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Reembolsos — Kiwi',
  description: 'Si algo salió mal con tu pedido: cómo cancelar y cómo recibís tu dinero de vuelta.',
};

export default function RefundsPage() {
  return <LegalDocView doc="refunds" />;
}
