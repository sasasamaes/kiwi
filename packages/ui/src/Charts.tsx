// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * Fachada de gráficos. Los widgets ligeros (StatCard, PeriodSelector) viven
 * en ChartWidgets.tsx; los gráficos reales (recharts ~900KB) en ChartsLazy.tsx,
 * cargados vía next/dynamic — el chunk se descarga SOLO cuando una página
 * renderiza un gráfico, no en el bundle inicial de cada app.
 *
 * Mantiene exactamente las mismas exportaciones y firmas que el módulo
 * monolítico original, así ningún consumidor cambia.
 */
import dynamic from 'next/dynamic';

export { StatCard, PeriodSelector } from './ChartWidgets';

const loadingFallback = () => null;

export const LineChartComponent = dynamic(
  () => import('./ChartsLazy').then((m) => m.LineChartComponent),
  { ssr: false, loading: loadingFallback },
);
export const AreaChartComponent = dynamic(
  () => import('./ChartsLazy').then((m) => m.AreaChartComponent),
  { ssr: false, loading: loadingFallback },
);
export const BarChartComponent = dynamic(
  () => import('./ChartsLazy').then((m) => m.BarChartComponent),
  { ssr: false, loading: loadingFallback },
);
export const PieChartComponent = dynamic(
  () => import('./ChartsLazy').then((m) => m.PieChartComponent),
  { ssr: false, loading: loadingFallback },
);
export const MultiLineChartComponent = dynamic(
  () => import('./ChartsLazy').then((m) => m.MultiLineChartComponent),
  { ssr: false, loading: loadingFallback },
);
