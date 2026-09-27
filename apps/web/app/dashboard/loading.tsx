// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { KiwiLoader, StatCardSkeleton } from '@kiwi/ui';

/** Carga del dashboard: kiwi + skeletons de stat-cards (evita el salto al llegar la página real). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-center">
        <KiwiLoader />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
