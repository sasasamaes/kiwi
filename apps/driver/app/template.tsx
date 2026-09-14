import { PageTransition } from '@kiwi/ui';

/**
 * Transición de ruta: este template se REMONTA en cada navegación, así que
 * la entrada corre en cada cambio de página (lo que template.tsx hace y
 * layout.tsx no). Reduce-motion degrada a fade corto.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
