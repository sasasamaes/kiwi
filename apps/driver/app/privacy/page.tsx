// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Privacidad — Kiwi Driver',
  description:
    'Qué datos recopila Kiwi de los repartidores: KYC, ubicación, pagos y cómo ejercer tus derechos.',
};

export default function PrivacyPage() {
  return <LegalDocView doc="privacy" />;
}
