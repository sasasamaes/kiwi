'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Rebanada de kiwi como SVG inline (misma obra que el favicon: ver
 * packages/ui/assets/kiwi-icon.svg y scripts/generate-icons.mjs). Un solo
 * lugar para la marca animada — KiwiLoader y KiwiMark la comparten.
 */
export function KiwiSlice({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <defs>
        <radialGradient id="kiwiSkin" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="60%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="kiwiFlesh" cx="42%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#eaf9e0" />
          <stop offset="70%" stopColor="#cdeb9f" />
          <stop offset="100%" stopColor="#a3d86b" />
        </radialGradient>
      </defs>
      <circle cx="256" cy="256" r="232" fill="url(#kiwiSkin)" />
      <circle cx="256" cy="256" r="180" fill="url(#kiwiFlesh)" />
      <path
        fill="#f8fdf2"
        d="M256 148c-52-46-138-20-138 56 0 74 92 132 138 160 46-28 138-86 138-160 0-76-86-102-138-56z"
      />
      <g fill="#1c2b18">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <ellipse
            key={`a${deg}`}
            cx="256"
            cy="176"
            rx="10"
            ry="17"
            transform={`rotate(${deg} 256 252)`}
          />
        ))}
        {[22, 67, 112, 157, 202, 247, 292, 337].map((deg) => (
          <ellipse
            key={`b${deg}`}
            cx="256"
            cy="120"
            rx="9"
            ry="15"
            transform={`rotate(${deg} 256 256)`}
          />
        ))}
      </g>
    </svg>
  );
}

export interface KiwiMarkProps {
  /** Tamaño en px (default 96). */
  size?: number;
  /** Flotación ambiente (levitar + balanceo lento). Default true. */
  floating?: boolean;
  className?: string;
}

/**
 * Marca animada del hero: el kiwi levita suave (±6px, balanceo ±3°, 4s).
 * Con prefers-reduced-motion queda estático — el fade de entrada lo pone
 * el padre si quiere.
 */
export function KiwiMark({ size = 96, floating = true, className = '' }: KiwiMarkProps) {
  const reduced = useReducedMotion();

  if (reduced || !floating) {
    return (
      <div className={className}>
        <KiwiSlice size={size} />
      </div>
    );
  }

  return (
    <div className={className}>
      <motion.div
        animate={{ y: [0, -6, 0], rotate: [-3, 3, -3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="inline-block drop-shadow-[0_16px_24px_rgba(34,197,94,0.35)]"
        style={{ willChange: 'transform' }}
      >
        <KiwiSlice size={size} />
      </motion.div>
    </div>
  );
}

export interface KiwiLogoProps {
  /** Diámetro de la rebanada en px (default 28). */
  size?: number;
  /** Variante del wordmark. Default 'brand'. */
  variant?: 'brand' | 'mono';
  className?: string;
}

/**
 * Lockup oficial de marca: rebanada + wordmark. Para headers, navs y auth
 * de las 3 apps — un solo lugar para que el logo se vea igual en todos lados.
 */
export function KiwiLogo({ size = 28, variant = 'brand', className = '' }: KiwiLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <KiwiSlice size={size} />
      <span
        className={`font-display font-bold leading-none ${
          variant === 'brand' ? 'text-kiwi-500' : 'text-surface-800 dark:text-surface-100'
        }`}
        style={{ fontSize: size * 0.72 }}
      >
        Kiwi
      </span>
    </span>
  );
}
