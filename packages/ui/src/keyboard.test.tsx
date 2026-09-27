// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
// @vitest-environment jsdom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { VehicleSelector, vehicles } from './VehicleSelector';
import { FileDropZone } from './FileDropZone';

/**
 * Contratos de teclado (WCAG 2.1.1 — todo operable sin mouse):
 *  - VehicleSelector: radiogroup ARIA con roving tabindex — un solo tab
 *    stop, ↑↓/←→ mueven selección y foco, con envoltura en los extremos.
 *  - FileDropZone: el input file nativo es el control enfocable (no oculto
 *    con display:none), con nombre accesible y onChange conectado.
 *
 * Mismo enfoque que TapButton.test.tsx: react-dom/client directo + jsdom,
 * sin dependencias nuevas de test.
 */

let container: HTMLElement | null = null;
let root: Root | null = null;

const mount = (jsx: React.ReactElement) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(jsx);
  });
};

const radios = () => [...container!.querySelectorAll('[role="radio"]')] as HTMLButtonElement[];

const fileInput = () => container!.querySelector('input[type="file"]') as HTMLInputElement;

const key = (el: HTMLElement, k: string) => {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  });
};

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
  }
  container?.remove();
  container = null;
  root = null;
});

describe('VehicleSelector — radiogroup navegable con teclado', () => {
  it('expone un solo tab stop: el seleccionado, o el primero si no hay selección', () => {
    mount(<VehicleSelector selected={null} onSelect={() => {}} />);
    const all = radios();
    expect(all).toHaveLength(vehicles.length);
    const tabStops = all.filter((r) => r.tabIndex === 0);
    expect(tabStops).toHaveLength(1);
    expect(tabStops[0]).toBe(all[0]);
  });

  it('el tab stop sigue al radio marcado y aria-checked refleja la selección', () => {
    mount(<VehicleSelector selected="car" onSelect={() => {}} />);
    const all = radios();
    expect(all[3].tabIndex).toBe(0);
    expect(all[0].tabIndex).toBe(-1);
    expect(all[3].getAttribute('aria-checked')).toBe('true');
    expect(all[0].getAttribute('aria-checked')).toBe('false');
  });

  it('ArrowDown selecciona el siguiente vehículo y mueve el foco', () => {
    const onSelect = vi.fn();
    mount(<VehicleSelector selected={null} onSelect={onSelect} />);
    const all = radios();
    act(() => all[0].focus());
    key(all[0], 'ArrowDown');
    expect(onSelect).toHaveBeenCalledWith(vehicles[1].type);
    expect(document.activeElement).toBe(all[1]);
  });

  it('ArrowUp desde el primero envuelve al último', () => {
    const onSelect = vi.fn();
    mount(<VehicleSelector selected={null} onSelect={onSelect} />);
    const all = radios();
    act(() => all[0].focus());
    key(all[0], 'ArrowUp');
    expect(onSelect).toHaveBeenCalledWith(vehicles[vehicles.length - 1].type);
  });

  it('los botones no envían un formulario padre (type="button")', () => {
    mount(<VehicleSelector selected={null} onSelect={() => {}} />);
    expect(radios().every((r) => r.type === 'button')).toBe(true);
  });
});

describe('FileDropZone — carga de archivos con teclado', () => {
  it('el input nativo es el control enfocable y tiene nombre accesible', () => {
    mount(<FileDropZone label="Subir selfie" value={null} onChange={() => {}} />);
    const input = fileInput();
    // No debe estar oculto para el teclado (display:none no es enfocable).
    expect(input.className).not.toContain('hidden');
    expect(input.getAttribute('aria-label')).toBe('Subir selfie');
  });

  it('seleccionar archivo dispara onChange con el File', () => {
    const onChange = vi.fn();
    mount(<FileDropZone label="Subir" value={null} onChange={onChange} />);
    const input = fileInput();
    const file = new File(['x'], 'doc.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });
    act(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(file);
  });

  it('muestra el nombre del archivo subido', () => {
    const file = new File(['x'], 'licencia.pdf', { type: 'application/pdf' });
    mount(<FileDropZone label="Subir" value={file} onChange={() => {}} />);
    expect(container!.textContent).toContain('licencia.pdf');
  });
});
