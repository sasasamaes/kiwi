// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plan de Ventas | KIWI',
  description:
    'Playbook comercial Kiwi: ICP, propuesta de valor, guiones y objeciones para comercios y repartidores de Nicoya.',
  robots: { index: false, follow: false },
};

export default function VentasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
