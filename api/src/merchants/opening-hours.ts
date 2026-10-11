// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Horarios de comercio en hora de Costa Rica (UTC-6, sin DST).
 *
 * El servidor corre en UTC: usar getDay()/getHours() directo desplaza todo
 * 6 horas (un "solo jueves" abriría miércoles). Todo lo que evalúe horarios
 * — discover, menú público, filtro de días — pasa por acá.
 */

import { crWeekday, crTimeHHMM } from '../common/costa-rica-time';

/**
 * ¿Abierto ahora? Formato { monday: { open: '08:00', close: '17:00' }, … }.
 * Sin horarios → abierto. Día ausente/nulo → cerrado (así "solo jueves"
 * cierra el resto de la semana).
 */
export function isOpenNow(openingHours: any, date = new Date()): boolean {
  if (!openingHours) return true;
  try {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayHours = openingHours[dayNames[crWeekday(date)]];
    if (!todayHours) return false;
    const now = crTimeHHMM(date);
    return now >= todayHours.open && now <= todayHours.close;
  } catch {
    return true;
  }
}

/**
 * ¿Se ofrece este producto hoy? availableDays vacío = todos los días.
 * Ej. rollos de canela solo jueves → [4].
 */
export function offeredToday(availableDays: unknown, date = new Date()): boolean {
  if (!Array.isArray(availableDays) || availableDays.length === 0) return true;
  return availableDays.includes(crWeekday(date));
}
