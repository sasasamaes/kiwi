import type { Http } from '@kiwi/mobile-core';

export interface MenuItemInput {
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  isAvailable?: boolean;
  stockQty?: number | null;
  imageUrl?: string | null;
}

export function menuApi(http: Http) {
  return {
    // Platos del comercio (`GET /menu/my`).
    items: () => http.get<any[]>('/menu/my'),
    // Crear plato (`POST /menu/my`).
    create: (data: MenuItemInput) => http.post<any>('/menu/my', data),
    // Editar plato (`PUT /menu/my/:id`).
    update: (itemId: string, data: Partial<MenuItemInput>) =>
      http.put<any>(`/menu/my/${itemId}`, data),
    // Prender/apagar disponibilidad (`PUT /menu/my/:id` con isAvailable).
    setAvailable: (itemId: string, isAvailable: boolean) =>
      http.put<any>(`/menu/my/${itemId}`, { isAvailable }),
    // Eliminar plato (`DELETE /menu/my/:id`).
    remove: (itemId: string) => http.delete<any>(`/menu/my/${itemId}`),
    // Kioscos del comercio (`GET /menu/my/kiosks`).
    kiosks: () => http.get<any[]>('/menu/my/kiosks'),
  };
}
