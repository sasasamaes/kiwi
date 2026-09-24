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

  // Get current location
  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }

    setGettingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get address
      const result = await api.reverseGeocode(latitude, longitude);

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
      console.error('Geolocation error:', error);
      alert('No se pudo obtener tu ubicación. Por favor, ingresa la dirección manualmente.');
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
          className="w-full px-4 py-3 pl-10 pr-20 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-500 transition-all"
        />

        {/* Search icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
          {loading ? (
            <motion.div
              className="w-5 h-5 border-2 border-kiwi-500 border-t-transparent rounded-full"
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
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-600 dark:text-kiwi-400 text-sm font-medium hover:bg-kiwi-200 dark:hover:bg-kiwi-900/70 transition-colors disabled:opacity-50"
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
                  <span className="text-xs text-surface-400 dark:text-surface-500 whitespace-nowrap">
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
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
              Intenta con otro término o usa tu ubicación actual
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default AddressInput;
