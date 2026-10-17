// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './api-client';
import { MapPin, RefreshCw, Search } from 'lucide-react';

interface AddressResult {
  placeId: string;
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
  type: string;
  address: {
    houseNumber?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    countryCode?: string;
  };
}

export interface AddressInputProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  focusOnMount?: boolean;
  nicoyaOnly?: boolean;
  onLocationSelect?: (location: { lat: number; lng: number; address: string }) => void;
}

export function AddressInput({
  value,
  onChange,
  placeholder = 'Buscar dirección...',
  label,
  required = false,
  className = '',
  focusOnMount = false,
  nicoyaOnly = true,
  onLocationSelect,
}: AddressInputProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus on mount if requested
  useEffect(() => {
    if (focusOnMount && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focusOnMount]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const searchAddresses = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        let results: AddressResult[];

        if (nicoyaOnly) {
          results = await api.searchNicoyaAddresses(searchQuery, 6);
        } else {
          results = await api.searchAddresses(searchQuery, 6, 'cr');
        }

        setSuggestions(results);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Geocoding search failed:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [nicoyaOnly],
  );

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search (700ms: el backend espacia Nominatim a 1.1s por IP)
    debounceRef.current = setTimeout(() => {
      searchAddresses(newValue);
    }, 700);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: AddressResult) => {
    setQuery(suggestion.shortName);
    onChange(suggestion.shortName, { lat: suggestion.lat, lng: suggestion.lng });
    setShowSuggestions(false);
    setSuggestions([]);

    if (onLocationSelect) {
      onLocationSelect({
        lat: suggestion.lat,
        lng: suggestion.lng,
        address: suggestion.shortName,
      });
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Mensaje claro según el motivo del fallo (sin alert() nativo: bloquea
  // la página y en móvil se ve roto).
  const geoErrorMessage = (code?: number): string => {
    if (code === 1) {
      return 'Permiso de ubicación denegado. Activalo en el navegador (ícono de la barra de dirección) o escribí la dirección a mano.';
    }
    if (code === 2) {
      return 'No se pudo determinar tu posición. Probá cerca de una ventana o con el WiFi encendido, o escribí la dirección a mano.';
    }
    return 'La ubicación tardó demasiado. Revisá tu conexión o escribí la dirección a mano.';
  };

  const getPosition = (options: PositionOptions): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, options),
    );

  // Get current location
  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no soporta geolocalización. Escribí la dirección a mano.');
      return;
    }

    setGettingLocation(true);
    setGeoError(null);

    try {
      let position: GeolocationPosition;
      try {
        // Intento 1: alta precisión (GPS del celu).
        position = await getPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      } catch (first) {
        // Reintento: sin alta precisión (en desktop no hay GPS y el modo
        // preciso suele dar timeout; red/WiFi responde igual).
        const code = (first as GeolocationPositionError | undefined)?.code;
        if (code === 1) throw first; // permiso denegado: reintentar no ayuda
        position = await getPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000,
        });
      }

      const { latitude, longitude } = position.coords;

      // Reverse geocode a nombre legible. Si falla (red), igual tenemos las
      // coords: se usan como dirección, sin mostrar error de GPS.
      let result: Awaited<ReturnType<typeof api.reverseGeocode>> | null = null;
      try {
        result = await api.reverseGeocode(latitude, longitude);
      } catch {
        result = null;
      }

      if (result) {
        setQuery(result.shortName);
        onChange(result.shortName, { lat: latitude, lng: longitude });

        if (onLocationSelect) {
          onLocationSelect({
            lat: latitude,
            lng: longitude,
            address: result.shortName,
          });
        }
      } else {
        // Use coordinates as address
        const coordAddress = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setQuery(coordAddress);
        onChange(coordAddress, { lat: latitude, lng: longitude });
      }
    } catch (error) {
      const code = (error as GeolocationPositionError | undefined)?.code;
      // El reverse-geocode fallando NO es error de GPS (ya tenemos coords):
      // solo se muestra este mensaje cuando falló la posición en sí.
      if (code === 1 || code === 2 || code === 3) {
        setGeoError(geoErrorMessage(code));
      } else {
        setGeoError('No se pudo obtener tu ubicación. Escribí la dirección a mano.');
      }
    } finally {
      setGettingLocation(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'house':
      case 'building':
        return 'home';
      case 'road':
      case 'street':
        return '🛣️';
      case 'city':
      case 'town':
      case 'village':
        return '🏙️';
      case 'neighbourhood':
      case 'suburb':
        return '🏘️';
      default:
        return 'location';
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pl-10 pr-20 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 transition-all"
        />

        {/* Search icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-surface-400">
          {loading ? (
            <motion.div
              className="w-5 h-5 border-2 border-kiwi-600 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <Search className="h-5 w-5" />
          )}
        </div>

        {/* Location button */}
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={gettingLocation}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 text-sm font-medium hover:bg-kiwi-200 dark:hover:bg-kiwi-900/70 transition-colors disabled:opacity-50"
        >
          {gettingLocation ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="block"
            >
              <RefreshCw className="h-4 w-4" />
            </motion.span>
          ) : (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" /> Mi ubicación
            </span>
          )}
        </button>
      </div>

      {/* Error de GPS en línea (nunca alert() nativo): explica y reintenta */}
      <AnimatePresence>
        {geoError && (
          <motion.div
            className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="text-xs text-amber-700 dark:text-amber-300">{geoError}</p>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300 underline"
              >
                Reintentar ubicación
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            className="absolute z-50 w-full mt-2 bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-surface-200 dark:border-surface-700 overflow-hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="max-h-64 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion.placeId}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-kiwi-50 dark:bg-kiwi-900/30'
                      : 'hover:bg-surface-50 dark:hover:bg-surface-700/50'
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <span className="text-xl mt-0.5">{getIcon(suggestion.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-surface-800 dark:text-surface-100 truncate">
                      {suggestion.shortName}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 truncate mt-0.5">
                      {suggestion.displayName}
                    </p>
                  </div>
                  <span className="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap">
                    MapPin {suggestion.lat.toFixed(4)}, {suggestion.lng.toFixed(4)}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-surface-50 dark:bg-surface-700/50 border-t border-surface-200 dark:border-surface-700">
              <p className="text-xs text-surface-500 dark:text-surface-400 text-center">
                Powered by OpenStreetMap • Gratuito
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No results */}
      {showSuggestions && suggestions.length === 0 && !loading && query.length >= 2 && (
        <motion.div
          className="absolute z-50 w-full mt-2 bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-surface-200 dark:border-surface-700 p-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center">
            <Search className="text-2xl block mb-2 h-6 w-6" />
            <p className="text-sm text-surface-500 dark:text-surface-400">
              No se encontraron direcciones para "{query}"
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
              Intenta con otro término o usa tu ubicación actual
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default AddressInput;
