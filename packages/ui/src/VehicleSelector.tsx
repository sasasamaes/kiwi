// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from './utils';
import { Bike, Truck, Car, Package, Weight } from 'lucide-react';

export type VehicleType = 'motorcycle' | 'motorized_bike' | 'bicycle' | 'car' | 'truck';

export interface Vehicle {
  type: VehicleType;
  name: string;
  icon: string;
  description: string;
  capacity: string;
  maxWeight: string;
  basePrice: number; // Price per km
}

export const vehicles: Vehicle[] = [
  {
    type: 'motorcycle',
    name: 'Moto',
    icon: 'Moto',
    description: 'Rápida y ágil',
    capacity: 'Paquetes pequeños',
    maxWeight: 'Hasta 10 kg',
    basePrice: 500,
  },
  {
    type: 'motorized_bike',
    name: 'Bici Moto',
    icon: 'Bici Moto',
    description: 'Económica y práctica',
    capacity: 'Paquetes pequeños',
    maxWeight: 'Hasta 5 kg',
    basePrice: 400,
  },
  {
    type: 'bicycle',
    name: 'Bici',
    icon: 'Bici',
    description: 'Ecológica y gratis',
    capacity: 'Paquetes muy pequeños',
    maxWeight: 'Hasta 3 kg',
    basePrice: 300,
  },
  {
    type: 'car',
    name: 'Carro',
    icon: 'Carro',
    description: 'Amplio y cómodo',
    capacity: 'Paquetes medianos',
    maxWeight: 'Hasta 50 kg',
    basePrice: 800,
  },
  {
    type: 'truck',
    name: 'Camión',
    icon: 'Camion',
    description: 'Para cargas grandes',
    capacity: 'Fletes y carga pesada',
    maxWeight: 'Hasta 500 kg',
    basePrice: 1500,
  },
];

interface VehicleSelectorProps {
  selected: VehicleType | null;
  onSelect: (type: VehicleType) => void;
  showDetails?: boolean;
}

export function VehicleSelector({ selected, onSelect, showDetails = true }: VehicleSelectorProps) {
  // Roving tabindex (WAI-ARIA radio group): un solo tab stop — el radio
  // marcado (o el primero si no hay selección). ↑↓/←→ mueven el foco Y
  // seleccionan, Espacio/Enter confirman (selección con teclado y mouse).
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    let next: number | null = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % vehicles.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
      next = (index - 1 + vehicles.length) % vehicles.length;
    if (next !== null) {
      e.preventDefault();
      onSelect(vehicles[next].type);
      radioRefs.current[next]?.focus();
    }
  };

  return (
    <div role="radiogroup" aria-label="Tipo de vehículo" className="space-y-3">
      {vehicles.map((vehicle, i) => (
        <motion.button
          key={vehicle.type}
          ref={(el) => {
            radioRefs.current[i] = el;
          }}
          type="button"
          onClick={() => onSelect(vehicle.type)}
          onKeyDown={handleKeyDown(i)}
          role="radio"
          aria-checked={selected === vehicle.type}
          aria-label={`${vehicle.name}: ${vehicle.description}`}
          tabIndex={selected === vehicle.type || (selected === null && i === 0) ? 0 : -1}
          className={cn(
            'w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600',
            selected === vehicle.type
              ? 'border-2 border-kiwi-600 bg-kiwi-50 shadow-kiwi'
              : 'border border-surface-200 bg-white hover:border-surface-300 hover:shadow-soft',
          )}
          whileTap={{ scale: 0.98 }}
        >
          {/* Icon */}
          <motion.div
            aria-hidden
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-xl text-2xl',
              selected === vehicle.type ? 'bg-kiwi-100' : 'bg-surface-100',
            )}
            animate={selected === vehicle.type ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            {vehicle.type === 'motorcycle' && <Bike className="h-6 w-6" />}
            {vehicle.type === 'motorized_bike' && <Bike className="h-6 w-6" />}
            {vehicle.type === 'bicycle' && <Bike className="h-6 w-6" />}
            {vehicle.type === 'car' && <Car className="h-6 w-6" />}
            {vehicle.type === 'truck' && <Truck className="h-6 w-6" />}
          </motion.div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-surface-800">{vehicle.name}</h3>
              {selected === vehicle.type && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-kiwi-500"
                >
                  ✓
                </motion.span>
              )}
            </div>
            <p className="text-sm text-surface-500">{vehicle.description}</p>

            {showDetails && (
              <div className="mt-2 flex gap-3 text-xs text-surface-500 dark:text-surface-400">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" aria-hidden /> {vehicle.capacity}
                </span>
                <span className="flex items-center gap-1">
                  <Weight className="h-3 w-3" aria-hidden /> {vehicle.maxWeight}
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="text-sm font-semibold text-kiwi-700">₡{vehicle.basePrice}</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">/km</p>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

// Vehicle badge component
interface VehicleBadgeProps {
  type: VehicleType;
  size?: 'sm' | 'md' | 'lg';
  /** En pantallas angostas muestra solo el icono (evita desborde del header). */
  hideLabelOnMobile?: boolean;
}

export function VehicleBadge({ type, size = 'md', hideLabelOnMobile = false }: VehicleBadgeProps) {
  const vehicle = vehicles.find((v) => v.type === type);

  const sizes = {
    sm: 'h-6 px-2 text-xs',
    md: 'h-8 px-3 text-sm',
    lg: 'h-10 px-4 text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-100 font-medium text-surface-700',
        sizes[size],
      )}
    >
      <span aria-hidden>
        {vehicle?.type === 'motorcycle' ||
        vehicle?.type === 'motorized_bike' ||
        vehicle?.type === 'bicycle' ? (
          <Bike className="h-4 w-4" />
        ) : vehicle?.type === 'car' ? (
          <Car className="h-4 w-4" />
        ) : (
          <Truck className="h-4 w-4" />
        )}
      </span>
      <span className={hideLabelOnMobile ? 'hidden min-[400px]:inline' : undefined}>
        {vehicle?.name}
      </span>
    </span>
  );
}
