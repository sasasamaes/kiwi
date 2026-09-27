// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Reembolsos — Kiwi',
  description:
    'Cuándo y cómo se cancela un pedido en Kiwi y cómo recibís tu reembolso según el método de pago.',
};

export default function RefundsPage() {
  return <LegalDocView doc="refunds" />;
}
