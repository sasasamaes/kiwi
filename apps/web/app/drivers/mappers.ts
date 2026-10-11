/** Perfil de repartidor normalizado para las vistas del comercio. */
export interface Driver {
  id: string;
  fullName: string;
  vehicleType?: string;
  vehiclePlate?: string;
  photoUrl?: string;
  rating?: number;
  totalTrips?: number;
  status?: string;
}

/**
 * Normaliza a perfil de repartidor: favoritos viene como
 * {id: favoriteId, driver: {...perfil}}, disponibles como perfil directo.
 */
export const toDriverList = (data: any): Driver[] => {
  const raw = Array.isArray(data) ? data : (data?.drivers ?? data?.favorites ?? data?.data ?? []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => {
      const p = item?.driver ?? item;
      if (!p?.id) return null;
      return {
        id: String(p.id),
        fullName: p.fullName ?? 'Repartidor',
        vehicleType: p.vehicleType,
        vehiclePlate: p.vehiclePlate,
        photoUrl: p.photoUrl ?? undefined,
        rating: p.rating != null ? Number(p.rating) : undefined,
        totalTrips: p.totalTrips != null ? Number(p.totalTrips) : undefined,
        status: p.status,
      } as Driver;
    })
    .filter(Boolean) as Driver[];
};
