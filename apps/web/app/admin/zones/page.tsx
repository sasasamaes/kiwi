// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Ban, RotateCcw, Check, Sparkles, Minus } from 'lucide-react';
import { api, useAuth, useTranslations, addStreetsAndSatellite } from '@kiwi/ui';
import { ZonesOverviewMap } from './ZonesOverviewMap';
import { kiwiIcon } from './markers';

type Ring = number[][]; // [[lng,lat], …]

interface Zone {
  id: string;
  label: string;
  price: number;
  latitude?: number | null;
  longitude?: number | null;
  geometry?: { type: 'Polygon' | 'MultiPolygon'; coordinates: any } | null;
  referenceOnly?: boolean;
  active: boolean;
  sortOrder?: number;
}

const EMPTY_FORM = {
  id: '',
  label: '',
  price: 1000,
  latitude: '' as number | string,
  longitude: '' as number | string,
  active: true,
  sortOrder: 0,
};

const NICoya: [number, number] = [10.1467, -85.452];
/** Primer anillo del polígono (o primer polígono del multipolígono) → vértices. */
function firstRing(g: Zone['geometry']): Ring | null {
  if (!g) return null;
  if (g.type === 'Polygon') return g.coordinates?.[0] ?? null;
  if (g.type === 'MultiPolygon') return g.coordinates?.[0]?.[0] ?? null;
  return null;
}

/** Haversine en km (para dimensionar el polígono generado). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const t = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(t(lat2 - lat1) / 2) ** 2 +
    Math.cos(t(lat1)) * Math.cos(t(lat2)) * Math.sin(t(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** ¿Punto de referencia usable? Ojo: (0,0) = Null Island (ej. Number(null)), no es punto real. */
const hasPoint = (z: Zone) => {
  if (z.latitude == null || z.longitude == null) return false;
  const la = Number(z.latitude);
  const ln = Number(z.longitude);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (la === 0 && ln === 0) return false;
  return true;
};

/**
 * Anillo aproximado alrededor del punto de la zona (octágono): para
 * pre-marcar en vez de dibujar desde cero. El radio se ajusta al vecino más
 * cercano (45% de la distancia, tope 1 km, piso 250 m) para no traslapar de
 * entrada. Anillo ABIERTO (save() lo cierra). null = sin punto.
 */
function autoRingFor(zone: Zone, zones: Zone[], sides = 8): Ring | null {
  if (!hasPoint(zone)) return null;
  const lat = Number(zone.latitude);
  const lng = Number(zone.longitude);
  let nearest = Infinity;
  for (const z of zones) {
    if (z.id === zone.id || !hasPoint(z)) continue;
    nearest = Math.min(nearest, haversineKm(lat, lng, Number(z.latitude), Number(z.longitude)));
  }
  const radiusKm = Number.isFinite(nearest)
    ? Math.min(1.0, Math.max(0.25, (nearest / 2) * 0.9))
    : 0.5;
  const pts: Ring = [];
  for (let i = 0; i < sides; i++) {
    const bearing = (i / sides) * 2 * Math.PI;
    const dLat = (radiusKm / 111.32) * Math.cos(bearing);
    const dLng = (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(bearing);
    pts.push([lng + dLng, lat + dLat]);
  }
  return pts;
}

export default function AdminZonesPage() {
  const { t } = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [liveDrivers, setLiveDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [vertices, setVertices] = useState<Ring>([]); // [[lng,lat]]
  const [showForm, setShowForm] = useState(false);
  const [initKey, setInitKey] = useState(0);
  // Modo de edición del mapa: mover el punto de entrega o dibujar el polígono.
  const [mode, setMode] = useState<'point' | 'polygon'>('point');
  const modeRef = useRef<'point' | 'polygon'>('point');
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const pointMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  // Arrastre del polígono completo: capas vivas durante el gesto.
  const polyRef = useRef<any>(null);
  const vertexMarkersRef = useRef<any[]>([]);
  const wholeDragRef = useRef<{ startLat: number; startLng: number; verts: Ring } | null>(null);
  // Al soltar el polígono el mapa tira un 'click': se suprime una vez para
  // no plantar un vértice donde cayó.
  const suppressClickRef = useRef(false);

  const onWholeDragMove = (e: any) => {
    const drag = wholeDragRef.current;
    if (!drag || !polyRef.current) return;
    const dLat = e.latlng.lat - drag.startLat;
    const dLng = e.latlng.lng - drag.startLng;
    const moved = drag.verts.map(([x, y]) => [y + dLat, x + dLng]);
    polyRef.current.setLatLngs([moved]);
    vertexMarkersRef.current.forEach((m: any, i: number) => m?.setLatLng?.(moved[i]));
  };

  const onWholeDragEnd = (e: any) => {
    const drag = wholeDragRef.current;
    const map = mapObj.current;
    wholeDragRef.current = null;
    if (!drag || !map) return;
    map.off('mousemove', onWholeDragMove);
    map.dragging?.enable?.();
    const dLat = e.latlng.lat - drag.startLat;
    const dLng = e.latlng.lng - drag.startLng;
    if (Math.abs(dLat) < 1e-9 && Math.abs(dLng) < 1e-9) return;
    // Suprimir el click que Leaflet dispara al soltar.
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 300);
    setVertices(drag.verts.map(([x, y]) => [x + dLng, y + dLat]));
    // El punto de entrega viaja con el polígono.
    setForm((f) => {
      const la = Number(f.latitude);
      const ln = Number(f.longitude);
      if (f.latitude === '' || f.longitude === '' || !Number.isFinite(la) || !Number.isFinite(ln)) {
        return f;
      }
      return {
        ...f,
        latitude: (la + dLat).toFixed(6),
        longitude: (ln + dLng).toFixed(6),
      };
    });
  };

  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  // Espejo de vértices para el mover-todo (el handler de doble-clic los lee
  // fuera del render) y click pendiente (distinguir 1 clic de doble-clic).
  const vertsRef = useRef<Ring>([]);
  const pendingClick = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setZones((await api.adminListZones()) ?? []);
      // Negocios para la capa del mapa general (una vez por carga).
      try {
        const feed = await api.discoverMerchants({ city: 'nicoya', take: 50 });
        setMerchants(feed?.items ?? []);
      } catch {
        /* sin negocios no se cae el mapa */
      }
    } catch (err: any) {
      setMsg(err?.message || t('webadmin1.azones.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authLoading && user?.role === 'admin') void load();
  }, [authLoading, user, load]);

  // Repartidores en vivo: polling cada 15s (el driver pingea cada ~30s).
  useEffect(() => {
    if (authLoading || user?.role !== 'admin') return;
    let alive = true;
    const tick = async () => {
      try {
        const live = await api.adminLiveDrivers();
        if (alive) setLiveDrivers(Array.isArray(live) ? live : []);
      } catch {
        /* reintenta en el próximo ciclo */
      }
    };
    void tick();
    const t = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [authLoading, user]);

  // Mueve TODO el polígono (conservando la forma) para que su centro quede
  // donde se hizo doble-clic, y lleva el punto de referencia al centro nuevo.
  // Así un auto-generado que cayó en el lugar equivocado se reubica de una,
  // con lat/long coherentes para que el precio por zona funcione.
  const movePolygonTo = (lat: number, lng: number) => {
    const prev = vertsRef.current;
    if (prev.length < 3) return false;
    const closed =
      prev.length > 3 &&
      prev[0][0] === prev[prev.length - 1][0] &&
      prev[0][1] === prev[prev.length - 1][1];
    const pts = closed ? prev.slice(0, -1) : prev;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const dLng = lng - cx;
    const dLat = lat - cy;
    setVertices(pts.map(([x, y]) => [x + dLng, y + dLat]));
    setForm((f) => ({
      ...f,
      latitude: (cy + dLat).toFixed(6),
      longitude: (cx + dLng).toFixed(6),
    }));
    return true;
  };

  // Map init (client-only) — click agrega vértices al polígono.
  useEffect(() => {
    if (!showForm || !mapRef.current || mapObj.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default ?? (await import('leaflet'));
      LRef.current = L;
      if (cancelled || !mapRef.current) return;
      const lat0 = Number(form.latitude) || NICoya[0];
      const lng0 = Number(form.longitude) || NICoya[1];
      // Sin zoom-con-doble-clic: el doble-clic mueve el polígono entero.
      const map = L.map(mapRef.current, { doubleClickZoom: false }).setView(
        [lat0, lng0],
        Number.isFinite(Number(form.latitude)) ? 14 : 13,
      );
      addStreetsAndSatellite(map, L);
      map.on('click', (e: any) => {
        if (suppressClickRef.current) return;
        if (modeRef.current === 'point') {
          setForm((f) => ({
            ...f,
            latitude: e.latlng.lat.toFixed(6),
            longitude: e.latlng.lng.toFixed(6),
          }));
        } else {
          // En modo polígono el clic espera 260ms por si es la primera mitad
          // de un doble-clic (mover todo). El punto se ubica igual de rápido.
          if (pendingClick.current) clearTimeout(pendingClick.current);
          const { lat, lng } = e.latlng;
          pendingClick.current = setTimeout(() => {
            pendingClick.current = null;
            setVertices((prev) => [...prev, [lng, lat]]);
          }, 260);
        }
      });
      map.on('dblclick', (e: any) => {
        if (pendingClick.current) {
          clearTimeout(pendingClick.current);
          pendingClick.current = null;
        }
        movePolygonTo(e.latlng.lat, e.latlng.lng);
      });
      mapObj.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [showForm, initKey]);

  // Redibuja polígono + marcadores cuando cambian los vértices.
  useEffect(() => {
    const L = LRef.current;
    const map = mapObj.current;
    vertsRef.current = vertices;
    if (!L || !map) return;
    if (layerRef.current) layerRef.current.remove();
    const ll = vertices.map(([lng, lat]) => [lat, lng]);
    const layer = L.layerGroup().addTo(map);
    const vertexIcon = (n: number) =>
      L.divIcon({
        html: `<div style="width:20px;height:20px;border-radius:999px;background:#22c55e;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:grab;">${n}</div>`,
        className: 'zone-vertex',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    // Vértices arrastrables: seleccionás un punto y lo movés para corregir.
    vertexMarkersRef.current = [];
    ll.forEach((p: number[], i: number) => {
      const marker = L.marker(p, { icon: vertexIcon(i + 1), draggable: true }).addTo(layer);
      marker.bindTooltip(t('webadmin1.azones.vertexTip', { n: i + 1 }));
      marker.on('dragend', () => {
        const np = marker.getLatLng();
        setVertices((prev) => prev.map((v, idx) => (idx === i ? [np.lng, np.lat] : v)));
      });
      vertexMarkersRef.current.push(marker);
    });
    polyRef.current = null;
    if (ll.length >= 2) L.polyline(ll, { color: '#22c55e' }).addTo(layer);
    if (ll.length >= 3) {
      const poly = L.polygon(ll, { color: '#16a34a', fillOpacity: 0.25 }).addTo(layer);
      // Arrastre del OBJETO completo: agarrás el relleno/borde y movés todo
      // conservando la forma. El punto de entrega se mueve con él.
      try {
        (poly.getElement() as HTMLElement | null)?.style.setProperty('cursor', 'move');
      } catch {
        // SVG aún no pintado: el cursor igual funciona por defecto
      }
      poly.on('mousedown', (e: any) => {
        if (wholeDragRef.current) return;
        // Que no pelee con el arrastre de un vértice.
        try {
          e.originalEvent?.stopPropagation?.();
        } catch {
          // noop
        }
        wholeDragRef.current = {
          startLat: e.latlng.lat,
          startLng: e.latlng.lng,
          verts: vertsRef.current.map((v) => [...v] as [number, number]),
        };
        map.dragging?.disable?.();
        map.on('mousemove', onWholeDragMove);
        map.once('mouseup', onWholeDragEnd);
      });
      polyRef.current = poly;
    }
    layerRef.current = layer;

    // Punto de entrega (referencia) según lat/long, arrastrable para corregir.
    // Marca Kiwi en vez del pin default de Leaflet.
    if (pointMarkerRef.current) {
      pointMarkerRef.current.remove();
      pointMarkerRef.current = null;
    }
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (
      form.latitude !== '' &&
      form.longitude !== '' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      const pointIcon = kiwiIcon(L, { size: 34 });
      const marker = L.marker([lat, lng], { draggable: true, icon: pointIcon })
        .addTo(map)
        .bindTooltip(t('webadmin1.azones.pointTip'));
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        setForm((f) => ({ ...f, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }));
      });
      pointMarkerRef.current = marker;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertices, showForm, form.latitude, form.longitude, mapReady]);

  // Al abrir el editor (mapa listo): encuadrar el polígono o centrar en el punto.
  useEffect(() => {
    const L = LRef.current;
    const map = mapObj.current;
    if (!mapReady || !L || !map) return;
    if (vertices.length >= 2) {
      const bounds = L.latLngBounds(vertices.map(([lng, lat]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    } else {
      const lat = Number(form.latitude);
      const lng = Number(form.longitude);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        form.latitude !== '' &&
        form.longitude !== ''
      ) {
        map.setView([lat, lng], 15);
      }
    }
    // Solo al quedar listo el mapa (evita re-centrar mientras editás).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // Escala el objeto completo alrededor de su centroide (±10% por toque),
  // conservando la forma. El punto de entrega escala con él.
  const scalePolygon = (factor: number) => {
    const verts = vertsRef.current;
    if (verts.length < 3) return;
    const cx = verts.reduce((s, p) => s + p[0], 0) / verts.length;
    const cy = verts.reduce((s, p) => s + p[1], 0) / verts.length;
    setVertices(verts.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]));
    setForm((f) => {
      const la = Number(f.latitude);
      const ln = Number(f.longitude);
      if (f.latitude === '' || f.longitude === '' || !Number.isFinite(la) || !Number.isFinite(ln)) {
        return f;
      }
      return {
        ...f,
        latitude: (cy + (la - cy) * factor).toFixed(6),
        longitude: (cx + (ln - cx) * factor).toFixed(6),
      };
    });
  };

  const destroyMap = () => {
    if (pendingClick.current) {
      clearTimeout(pendingClick.current);
      pendingClick.current = null;
    }
    mapObj.current?.remove?.();
    mapObj.current = null;
    layerRef.current = null;
    LRef.current = null;
    setMapReady(false);
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setVertices([]);
    setMsg(null);
    setShowForm(true);
    setInitKey((k) => k + 1);
  };

  const openEdit = (z: Zone) => {
    destroyMap();
    setForm({
      id: z.id,
      label: z.label,
      price: Number(z.price),
      latitude: z.latitude ?? '',
      longitude: z.longitude ?? '',
      active: z.active,
      sortOrder: z.sortOrder ?? 0,
    });
    setVertices(firstRing(z.geometry) ?? []);
    setMsg(null);
    setShowForm(true);
    setInitKey((k) => k + 1);
  };

  const save = async () => {
    if (!form.label.trim()) {
      setMsg(t('webadmin1.azones.needName'));
      return;
    }
    const hasPt = form.latitude !== '' && form.longitude !== '';
    if (!hasPt && vertices.length < 3) {
      setMsg(t('webadmin1.azones.needPointOrPoly'));
      return;
    }
    const ring = vertices.length >= 3 ? [...vertices, vertices[0]] : null;
    const body: any = {
      label: form.label.trim(),
      price: Number(form.price) || 0,
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
      geometry: ring ? { type: 'Polygon', coordinates: [ring] } : null,
    };
    setSaving(true);
    setMsg(null);
    try {
      if (form.id) await api.adminUpdateZone(form.id, body);
      else await api.adminCreateZone(body);
      setShowForm(false);
      destroyMap();
      await load();
      setMsg(t('webadmin1.azones.saved'));
    } catch (err: any) {
      setMsg(err?.message || t('webadmin1.azones.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (z: Zone) => {
    try {
      await api.adminDeactivateZone(z.id);
      await load();
    } catch (err: any) {
      setMsg(err?.message || t('webadmin1.azones.deactivateError'));
    }
  };

  // Pre-marca el polígono de UNA zona (con punto pero sin geometría): abre el
  // editor con el anillo generado para corregir vértices y guardar.
  const autofillRow = (z: Zone) => {
    const ring = autoRingFor(z, zones);
    if (!ring) {
      setMsg(t('webadmin1.azones.noPointFor', { label: z.label }));
      return;
    }
    openEdit(z);
    setVertices(ring);
  };

  // Genera y GUARDA los polígonos de todas las zonas sin geometría (con
  // punto). Después se corrigen en el mapa: es punto de partida, no final.
  const [bulkSaving, setBulkSaving] = useState(false);
  const missingCount = zones.filter((z) => !z.geometry && hasPoint(z)).length;

  const bulkAutofill = async () => {
    const missing = zones.filter((z) => !z.geometry && hasPoint(z));
    if (missing.length === 0) return;
    if (!window.confirm(t('webadmin1.azones.confirmBulk', { n: missing.length }))) return;
    setBulkSaving(true);
    setMsg(null);
    let ok = 0;
    for (const z of missing) {
      const ring = autoRingFor(z, zones);
      if (!ring) continue;
      try {
        await api.adminUpdateZone(z.id, {
          geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
        });
        ok++;
      } catch {
        // sigue con las demás; el mapa muestra cuáles faltan
      }
    }
    setBulkSaving(false);
    await load();
    setMsg(
      ok === missing.length
        ? t('webadmin1.azones.bulkOk', { ok })
        : t('webadmin1.azones.bulkPartial', { ok, total: missing.length }),
    );
  };

  if (!authLoading && user?.role !== 'admin') {
    return <div className="p-6 text-sm text-surface-500">{t('webadmin1.azones.adminOnly')}</div>;
  }

  const hasPolygon = (z: Zone) => !!z.geometry;

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-surface-900 dark:text-white">
            {t('webadmin1.azones.title')}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {t('webadmin1.azones.subtitle')}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-kiwi-700 px-3 py-2 text-sm font-semibold text-white hover:bg-kiwi-800"
        >
          <Plus className="h-4 w-4" /> {t('webadmin1.azones.newZone')}
        </button>
      </div>
      {missingCount > 0 && (
        <button
          onClick={() => void bulkAutofill()}
          disabled={bulkSaving}
          className="mb-4 inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {bulkSaving
            ? t('webadmin1.azones.generating')
            : t('webadmin1.azones.generateMissing', { n: missingCount })}
        </button>
      )}

      {msg && <p className="mb-3 text-sm text-kiwi-700 dark:text-kiwi-300">{msg}</p>}

      {/* Mapa general: todas las zonas con su precio */}
      <div className="mb-6 rounded-2xl border border-surface-200/60 dark:border-white/10 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-surface-500 dark:text-surface-400">
          <span className="font-medium text-surface-700 dark:text-surface-200">
            {t('webadmin1.azones.allZones')}
          </span>
          <span className="flex items-center gap-1">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: '#15803d' }}
            />{' '}
            ≤ ₡1000
          </span>
          <span className="flex items-center gap-1">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: '#22c55e' }}
            />{' '}
            ≤ ₡2000
          </span>
          <span className="flex items-center gap-1">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: '#f59e0b' }}
            />{' '}
            ≤ ₡4000
          </span>
          <span className="flex items-center gap-1">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: '#dc2626' }}
            />{' '}
            &gt; ₡4000
          </span>
        </div>
        <ZonesOverviewMap zones={zones} merchants={merchants} drivers={liveDrivers} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-200/60 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 dark:bg-surface-800/60 text-surface-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">{t('webadmin1.azones.col.zone')}</th>
              <th className="px-4 py-3 text-right font-medium">
                {t('webadmin1.azones.col.price')}
              </th>
              <th className="px-4 py-3 text-center font-medium">
                {t('webadmin1.azones.col.polygon')}
              </th>
              <th className="px-4 py-3 text-center font-medium">
                {t('webadmin1.azones.col.active')}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t('webadmin1.azones.col.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-surface-500 dark:text-surface-400">
                  {t('webadmin1.azones.loading')}
                </td>
              </tr>
            ) : (
              zones.map((z) => (
                <tr
                  key={z.id}
                  className="border-t border-surface-100 dark:border-white/5 text-surface-800 dark:text-surface-200"
                >
                  <td className="px-4 py-3">
                    {z.label}
                    {hasPolygon(z) && !hasPoint(z) && (
                      <span
                        title={t('webadmin1.azones.areaOnlyTip')}
                        className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                      >
                        {t('webadmin1.azones.areaOnly')}
                      </span>
                    )}
                    {!hasPolygon(z) && hasPoint(z) && (
                      <span
                        title={t('webadmin1.azones.pointOnlyTip')}
                        className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      >
                        {t('webadmin1.azones.pointOnly')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    ₡{Number(z.price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {hasPolygon(z) ? (
                      '✓'
                    ) : hasPoint(z) ? (
                      <button
                        onClick={() => autofillRow(z)}
                        title={t('webadmin1.azones.autoTip')}
                        className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> {t('webadmin1.azones.auto')}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>{' '}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        z.active ? 'text-kiwi-600' : 'text-surface-500 dark:text-surface-400'
                      }
                    >
                      {z.active ? t('webadmin1.azones.active') : t('webadmin1.azones.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(z)}
                      className="mr-2 inline-flex items-center gap-1 text-kiwi-700 dark:text-kiwi-300"
                    >
                      <Pencil className="h-3.5 w-3.5" /> {t('webadmin1.azones.edit')}
                    </button>
                    {z.active && (
                      <button
                        onClick={() => deactivate(z)}
                        className="inline-flex items-center gap-1 text-red-600"
                      >
                        <Ban className="h-3.5 w-3.5" /> {t('webadmin1.azones.deactivate')}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto my-8 w-full max-w-2xl rounded-2xl border border-surface-200/60 dark:border-white/10 bg-white dark:bg-surface-800 p-5"
          >
            <h2 className="mb-4 font-display font-bold text-surface-900 dark:text-white">
              {form.id ? t('webadmin1.azones.editZone') : t('webadmin1.azones.newZone')}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-surface-500">{t('webadmin1.azones.nameLabel')}</span>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder={t('webadmin1.azones.namePh')}
                  className="mt-1 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-surface-500">{t('webadmin1.azones.priceLabel')}</span>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-surface-500">{t('webadmin1.azones.latLabel')}</span>
                <input
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="10.1467"
                  className="mt-1 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-surface-500">{t('webadmin1.azones.lngLabel')}</span>
                <input
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="-85.4520"
                  className="mt-1 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span className="text-surface-600 dark:text-surface-300">
                  {t('webadmin1.azones.active')}
                </span>
              </label>
              <label className="text-sm">
                <span className="text-surface-500">{t('webadmin1.azones.orderLabel')}</span>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('point')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    mode === 'point'
                      ? 'bg-kiwi-700 text-white'
                      : 'border border-surface-200 dark:border-surface-700'
                  }`}
                >
                  {t('webadmin1.azones.modePoint')}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('polygon')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    mode === 'polygon'
                      ? 'bg-kiwi-700 text-white'
                      : 'border border-surface-200 dark:border-surface-700'
                  }`}
                >
                  {t('webadmin1.azones.modePolygon', { n: vertices.length })}
                </button>
              </div>
              <p className="mb-2 text-xs text-surface-500">
                {mode === 'point'
                  ? t('webadmin1.azones.hintPoint')
                  : t('webadmin1.azones.hintPolygon', {
                      n: vertices.length,
                      s: vertices.length === 1 ? '' : 's',
                    })}
              </p>
              <div
                ref={mapRef}
                className="h-72 w-full overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setVertices([])}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> {t('webadmin1.azones.reset')}
                </button>
                <button
                  type="button"
                  onClick={() => setVertices((v) => v.slice(0, -1))}
                  disabled={!vertices.length}
                  className="rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  {t('webadmin1.azones.removeLast')}
                </button>
                <button
                  type="button"
                  onClick={() => scalePolygon(0.9)}
                  disabled={mode !== 'polygon' || vertices.length < 3}
                  title={t('webadmin1.azones.shrinkTip')}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" /> {t('webadmin1.azones.shrink')}
                </button>
                <button
                  type="button"
                  onClick={() => scalePolygon(1.1)}
                  disabled={mode !== 'polygon' || vertices.length < 3}
                  title={t('webadmin1.azones.shrinkTip')}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> {t('webadmin1.azones.grow')}
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, latitude: '', longitude: '' }))}
                  disabled={form.latitude === '' && form.longitude === ''}
                  title={t('webadmin1.azones.removePointTip')}
                  className="rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  {t('webadmin1.azones.removePoint')}
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-semibold text-white hover:bg-kiwi-800 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />{' '}
                {saving ? t('webadmin1.azones.saving') : t('webadmin1.azones.save')}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  destroyMap();
                }}
                className="rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-2 text-sm"
              >
                {t('webadmin1.azones.cancel')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
