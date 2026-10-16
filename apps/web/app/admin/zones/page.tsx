// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Ban, RotateCcw, Check } from 'lucide-react';
import { api, useAuth } from '@kiwi/ui';

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

export default function AdminZonesPage() {
  const { user, loading: authLoading } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
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

  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setZones((await api.adminListZones()) ?? []);
    } catch (err: any) {
      setMsg(err?.message || 'No se pudieron cargar las zonas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === 'admin') void load();
  }, [authLoading, user, load]);

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
      const map = L.map(mapRef.current).setView(
        [lat0, lng0],
        Number.isFinite(Number(form.latitude)) ? 14 : 13,
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      map.on('click', (e: any) => {
        if (modeRef.current === 'point') {
          setForm((f) => ({
            ...f,
            latitude: e.latlng.lat.toFixed(6),
            longitude: e.latlng.lng.toFixed(6),
          }));
        } else {
          setVertices((prev) => [...prev, [e.latlng.lng, e.latlng.lat]]);
        }
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
    ll.forEach((p: number[], i: number) => {
      const marker = L.marker(p, { icon: vertexIcon(i + 1), draggable: true }).addTo(layer);
      marker.bindTooltip(`Vértice ${i + 1} — arrastrá para mover`);
      marker.on('dragend', () => {
        const np = marker.getLatLng();
        setVertices((prev) => prev.map((v, idx) => (idx === i ? [np.lng, np.lat] : v)));
      });
    });
    if (ll.length >= 2) L.polyline(ll, { color: '#22c55e' }).addTo(layer);
    if (ll.length >= 3) L.polygon(ll, { color: '#16a34a', fillOpacity: 0.25 }).addTo(layer);
    layerRef.current = layer;

    // Punto de entrega (referencia) según lat/long, arrastrable para corregir.
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
      const marker = L.marker([lat, lng], { draggable: true })
        .addTo(map)
        .bindTooltip('Punto de entrega');
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        setForm((f) => ({ ...f, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }));
      });
      pointMarkerRef.current = marker;
    }
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

  const destroyMap = () => {
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
      setMsg('Poné un nombre a la zona');
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
      setMsg('Guardado ✓');
    } catch (err: any) {
      setMsg(err?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (z: Zone) => {
    try {
      await api.adminDeactivateZone(z.id);
      await load();
    } catch (err: any) {
      setMsg(err?.message || 'No se pudo desactivar');
    }
  };

  if (!authLoading && user?.role !== 'admin') {
    return <div className="p-6 text-sm text-surface-500">Solo administradores.</div>;
  }

  const hasPolygon = (z: Zone) => !!z.geometry;

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-surface-900 dark:text-white">
            Zonas y barrios
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Precio de envío por zona. El punto es referencia; el polígono habilita el cobro por
            cercanía.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-kiwi-700 px-3 py-2 text-sm font-semibold text-white hover:bg-kiwi-800"
        >
          <Plus className="h-4 w-4" /> Nueva zona
        </button>
      </div>

      {msg && <p className="mb-3 text-sm text-kiwi-700 dark:text-kiwi-300">{msg}</p>}

      <div className="overflow-hidden rounded-2xl border border-surface-200/60 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 dark:bg-surface-800/60 text-surface-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Zona</th>
              <th className="px-4 py-3 text-right font-medium">Precio</th>
              <th className="px-4 py-3 text-center font-medium">Polígono</th>
              <th className="px-4 py-3 text-center font-medium">Activo</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-surface-400">
                  Cargando…
                </td>
              </tr>
            ) : (
              zones.map((z) => (
                <tr
                  key={z.id}
                  className="border-t border-surface-100 dark:border-white/5 text-surface-800 dark:text-surface-200"
                >
                  <td className="px-4 py-3">{z.label}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    ₡{Number(z.price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">{hasPolygon(z) ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={z.active ? 'text-kiwi-600' : 'text-surface-400'}>
                      {z.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(z)}
                      className="mr-2 inline-flex items-center gap-1 text-kiwi-700 dark:text-kiwi-300"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    {z.active && (
                      <button
                        onClick={() => deactivate(z)}
                        className="inline-flex items-center gap-1 text-red-600"
                      >
                        <Ban className="h-3.5 w-3.5" /> Desactivar
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
              {form.id ? 'Editar zona' : 'Nueva zona'}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-surface-500">Nombre *</span>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Ej: Barrio Los Ángeles"
                  className="mt-1 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-surface-500">Precio (₡) *</span>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-surface-500">Latitud (referencia)</span>
                <input
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="10.1467"
                  className="mt-1 w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-surface-500">Longitud (referencia)</span>
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
                <span className="text-surface-600 dark:text-surface-300">Activa</span>
              </label>
              <label className="text-sm">
                <span className="text-surface-500">Orden</span>
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
                  📍 Punto de entrega
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
                  ▦ Polígono ({vertices.length})
                </button>
              </div>
              <p className="mb-2 text-xs text-surface-500">
                {mode === 'point'
                  ? 'Tocá el mapa para ubicar el punto de entrega (o arrastrá el marcador).'
                  : `Tocá el mapa para agregar vértices (${vertices.length} punto${
                      vertices.length === 1 ? '' : 's'
                    }); arrastrá un vértice para moverlo.`}
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
                  <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
                </button>
                <button
                  type="button"
                  onClick={() => setVertices((v) => v.slice(0, -1))}
                  disabled={!vertices.length}
                  className="rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Quitar último
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-kiwi-700 px-4 py-2 text-sm font-semibold text-white hover:bg-kiwi-800 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  destroyMap();
                }}
                className="rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
