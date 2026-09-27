// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata } from 'next';
import { LegalDocView } from '@kiwi/ui';

export const metadata: Metadata = {
  title: 'Cookies — Kiwi Driver',
  description:
    'Almacenamiento local de Kiwi Driver: sesión, sync offline y analítica opcional con tu consentimiento.',
};

export default function CookiesPage() {
  return <LegalDocView doc="cookies" />;
}
