import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Cookies — Kiwi',
  description:
    'Qué almacenamiento local y cookies usa Kiwi, para qué sirve cada clave y cómo cambiar tu decisión de analítica.',
};

export default function CookiesPage() {
  return <LegalDocView doc="cookies" />;
}
