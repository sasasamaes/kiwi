'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';
export type { Theme };

export const THEME_STORAGE_KEY = 'kiwi-theme';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Script inline que corre ANTES de la hidratación y pinta la clase correcta
 * en <html> de inmediato. Sin esto, un usuario en modo oscuro ve un flash
 * blanco en cada carga fría: el SSR no conoce su preferencia y el classList
 * solo se aplicaría en el primer useEffect (demasiado tarde).
 *
 * Debe montarse en el <head> del layout raíz de cada app. suppressHydrationWarning
 * en <html> evita el warning de mismatch de clase.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var c=document.documentElement.classList;if(d){c.add('dark');}else{c.add('light');}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      setTheme(savedTheme);
    }
    // Resolved inicial consistente con lo que ya pintó ThemeScript.
    setResolvedTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const effectiveTheme =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;

    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
    setResolvedTheme(effectiveTheme);

    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, mounted]);

  // Cambios de preferencia del sistema mientras theme === 'system'.
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      const newTheme = mediaQuery.matches ? 'dark' : 'light';
      root.classList.add(newTheme);
      setResolvedTheme(newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Siempre proveer el contexto (defaults hasta mounted) para no romper SSR.
  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/** Cicla claro → oscuro → sistema. Icono + etiqueta según el estado real. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  const getLabel = () => {
    if (theme === 'system') return 'Sistema';
    return resolvedTheme === 'dark' ? 'Oscuro' : 'Claro';
  };

  return (
    <motion.button
      onClick={cycleTheme}
      className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        resolvedTheme === 'dark'
          ? 'bg-surface-800 text-surface-200 hover:bg-surface-700'
          : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
      } ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={`Tema: ${getLabel()}`}
      aria-label={`Tema: ${getLabel()}. Cambiar a ${
        theme === 'system' ? 'claro' : theme === 'light' ? 'oscuro' : 'sistema'
      }`}
    >
      <motion.span
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Icon className="h-4 w-4" />
      </motion.span>
      <span className="hidden sm:inline">{getLabel()}</span>
    </motion.button>
  );
}
