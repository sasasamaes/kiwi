import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Términos — Kiwi Driver',
  description:
    'Términos de uso de Kiwi Driver: independencia del repartidor, KYC, envíos y uso aceptable.',
};

export default function TermsPage() {
  return <LegalDocView doc="terms" />;
}
