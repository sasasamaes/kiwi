// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  pointInRing,
  pointInPolygon,
  pointInGeometry,
  geometryArea,
  resolveZonePrice,
  type PriceZone,
  type ZoneGeometry,
} from '../orders/zone-geometry';

// Cuadrado ~1km alrededor de Nicoya centro.
const square = (d: number): ZoneGeometry => ({
  type: 'Polygon',
  coordinates: [
    [
      [-85.45 - d, 10.14 - d],
      [-85.45 + d, 10.14 - d],
      [-85.45 + d, 10.14 + d],
      [-85.45 - d, 10.14 + d],
      [-85.45 - d, 10.14 - d],
    ],
  ],
});
const centro = { lat: 10.14, lng: -85.45 };

describe('zone-geometry', () => {
  it('pointInRing: dentro vs afuera', () => {
    const ring = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ];
    expect(pointInRing({ lat: 1, lng: 1 }, ring)).toBe(true);
    expect(pointInRing({ lat: 3, lng: 1 }, ring)).toBe(false);
  });

  it('pointInPolygon respeta agujeros', () => {
    const withHole = [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [1, 1],
        [3, 1],
        [3, 3],
        [1, 3],
        [1, 1],
      ],
    ];
    expect(pointInPolygon({ lat: 0.5, lng: 0.5 }, withHole)).toBe(true);
    expect(pointInPolygon({ lat: 2, lng: 2 }, withHole)).toBe(false); // agujero
  });

  it('pointInGeometry soporta MultiPolygon', () => {
    const multi = {
      type: 'MultiPolygon',
      coordinates: [
        square(0.001).coordinates,
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      ],
    } as unknown as ZoneGeometry;
    expect(pointInGeometry(centro, multi)).toBe(true);
    expect(pointInGeometry({ lat: 0.5, lng: 0.5 }, multi)).toBe(true);
    expect(pointInGeometry({ lat: 5, lng: 5 }, multi)).toBe(false);
  });

  it('geometryArea: el cuadrado chico tiene menos área', () => {
    expect(geometryArea(square(0.001))).toBeLessThan(geometryArea(square(0.01)));
  });

  it('resolveZonePrice: gana la zona de MENOR área cuando se solapan', () => {
    const zones: PriceZone[] = [
      { id: 'big', label: 'Grande', price: 1000, geometry: square(0.01), referenceOnly: false },
      { id: 'small', label: 'Chico', price: 2000, geometry: square(0.001), referenceOnly: false },
    ];
    const r = resolveZonePrice(zones, centro);
    expect(r).toMatchObject({ source: 'polygon' });
    expect((r as any).zone.id).toBe('small');
  });

  it('resolveZonePrice: sin polígono que contenga → referencia más cercana (sugerencia)', () => {
    const zones: PriceZone[] = [
      {
        id: 'a',
        label: 'Lejos',
        price: 1500,
        latitude: 10.3,
        longitude: -85.6,
        referenceOnly: true,
      },
      {
        id: 'b',
        label: 'Cerca',
        price: 1000,
        latitude: 10.141,
        longitude: -85.451,
        referenceOnly: true,
      },
    ];
    const r = resolveZonePrice(zones, centro);
    expect(r).toMatchObject({ source: 'reference' });
    expect((r as any).zone.id).toBe('b');
  });

  it('resolveZonePrice: sin zonas → null', () => {
    expect(resolveZonePrice([], centro)).toBeNull();
  });
});
