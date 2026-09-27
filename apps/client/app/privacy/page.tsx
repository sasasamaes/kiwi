// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Privacidad — Kiwi',
  description:
    'Qué datos recopila Kiwi cuando pedís: nombre, teléfono, dirección y cómo se usan para tu pedido.',
};

export default function PrivacyPage() {
  return <LegalDocView doc="privacy" />;
}
