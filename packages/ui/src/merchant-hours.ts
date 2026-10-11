// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Formato legible de openingHours { monday: { open: '08:00', close: '20:00' } }
 * para la app cliente. Sin horarios → null (no se muestra nada).
 */

const DAYS: Array<{ key: string; short: string }> = [
  { key: 'monday', short: 'Lun' },
  { key: 'tuesday', short: 'Mar' },
  { key: 'wednesday', short: 'Mié' },
  { key: 'thursday', short: 'Jue' },
  { key: 'friday', short: 'Vie' },
  { key: 'saturday', short: 'Sáb' },
  { key: 'sunday', short: 'Dom' },
];

const fmt = (h: { open: string; close: string }) => `${h.open}–${h.close}`;

export interface FormattedHours {
  /** Ej. "Hoy 8:00–20:00" o "Hoy cerrado". */
  today: string;
  /** Una línea por día: "Lun 8:00–20:00" / "Dom cerrado". */
  week: string[];
}

export function formatOpeningHours(openingHours: any): FormattedHours | null {
  if (!openingHours || typeof openingHours !== 'object') return null;
  const week = DAYS.map(({ key, short }) => {
    const h = (openingHours as any)[key];
    return `${short} ${h?.open && h?.close ? fmt(h) : 'cerrado'}`;
  });
  // Si ningún día tiene horario válido, no hay nada que mostrar.
  if (week.every((l) => l.endsWith('cerrado'))) return null;
  const jsDay = new Date().getDay(); // 0=dom…6=sáb (el celu está en CR)
  const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    jsDay
  ];
  const todayH = (openingHours as any)[todayKey];
  return {
    today: todayH?.open && todayH?.close ? `Hoy ${fmt(todayH)}` : 'Hoy cerrado',
    week,
  };
}
