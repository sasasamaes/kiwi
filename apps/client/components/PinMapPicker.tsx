// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useRef } from 'react';
import { addStreetsAndSatellite, useTranslations } from '@kiwi/ui';

/**
 * Mini-mapa para marcar el punto exacto (el repartidor ve ese pin).
 * Click = poner/mover, arrastrar el kiwi = afinar. Con satélite para
 * reconocer locales desde arriba.
 */
export function PinMapPicker({
  lat,
  lng,
  onPick,
  heightClass = 'h-52',
  tooltip,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  heightClass?: string;
  tooltip?: string;
}) {
  const { t } = useTranslations();
  const tooltipText = tooltip ?? t('wclimisc.places.pinTooltip');
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const LRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const drawMarker = (la: number | null, ln: number | null) => {
    const L = LRef.current;
    const map = mapObj.current;
    if (!L || !map) return;
    if (markerObj.current) {
      markerObj.current.remove();
      markerObj.current = null;
    }
    if (la == null || ln == null) return;
    const icon = L.divIcon({
      html: `<img src="/kiwi.svg" alt="${t('wclimisc.places.pinAlt')}" style="width:34px;height:34px;display:block;border-radius:999px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);background:#fff;"/>`,
      className: 'pin-point',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker([la, ln], { draggable: true, icon })
      .addTo(map)
      .bindTooltip(tooltipText);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onPickRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
    });
    markerObj.current = marker;
  };

  // Init una vez por montaje.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod: any = await import('leaflet');
      if (cancelled || mapObj.current || !mapDivRef.current) return;
      const L = mod.default ?? mod;
      LRef.current = L;
      const hasPt = lat != null && lng != null;
      const map = L.map(mapDivRef.current).setView(
        hasPt ? [lat as number, lng as number] : [10.1467, -85.452],
        hasPt ? 16 : 13,
      );
      addStreetsAndSatellite(map, L);
      map.on('click', (e: any) => {
        onPickRef.current(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      });
      mapObj.current = map;
      setTimeout(() => {
        if (!cancelled && mapObj.current) mapObj.current.invalidateSize();
      }, 150);
      drawMarker(lat, lng);
    })();
    return () => {
      cancelled = true;
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
      }
      markerObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El GPS u otro cambio externo mueve el pin y centra el mapa.
  useEffect(() => {
    if (!mapObj.current) return;
    if (lat != null && lng != null) {
      mapObj.current.setView([lat, lng], Math.max(mapObj.current.getZoom(), 15));
    }
    drawMarker(lat, lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div
      ref={mapDivRef}
      className={`${heightClass} w-full overflow-hidden rounded-xl bg-surface-100 dark:bg-surface-800`}
    />
  );
}
