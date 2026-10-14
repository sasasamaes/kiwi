// api/src/__tests__/geocoding-public.spec.ts
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { GeocodingController } from '../geocoding/geocoding.controller';

/**
 * Regresión: el menú QR (apps/client) es anónimo y su checkout guest usa la
 * búsqueda de direcciones. Con el guard global default-deny, geocoding debe
 * estar marcado @Public() o el autocompletado de direcciones da 401.
 */
describe('GeocodingController @Public', () => {
  it('is marked @Public so anonymous QR checkout can search addresses', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, GeocodingController)).toBe(true);
  });
});
