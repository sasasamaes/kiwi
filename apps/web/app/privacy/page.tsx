import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Privacidad — Kiwi',
  description:
    'Qué datos recopila Kiwi, cómo los usa, con quién los comparte y cómo ejercer tus derechos.',
};

export default function PrivacyPage() {
  return <LegalDocView doc="privacy" />;
}
