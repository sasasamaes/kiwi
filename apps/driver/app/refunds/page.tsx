import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Reembolsos — Kiwi Driver',
  description:
    'Reglas de cancelación de pedidos y devolución de dinero en Kiwi, incluido el efecto en tu envío.',
};

export default function RefundsPage() {
  return <LegalDocView doc="refunds" />;
}
