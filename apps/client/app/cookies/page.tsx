import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Cookies — Kiwi',
  description:
    'Qué guarda Kiwi en tu navegador cuando pedís: solo lo necesario para tu sesión y pedido.',
};

export default function CookiesPage() {
  return <LegalDocView doc="cookies" />;
}
