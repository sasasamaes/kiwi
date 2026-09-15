// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { TapButton } from './TapButton';

/**
 * El evento onSuccess es el contrato nuevo: se dispara en el mismo instante
 * que el flash de éxito, una vez por click. Es lo que sincroniza efectos
 * externos (rebote del carrito) con el feedback del botón.
 *
 * Sin @testing-library: react-dom/client directo + jsdom por archivo
 * (// @vitest-environment jsdom) — cero dependencias nuevas de test.
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

const click = () => {
  const btn = container!.querySelector('button');
  act(() => {
    btn!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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

describe('TapButton', () => {
  it('dispara onSuccess exactamente cuando success está activo', () => {
    const onSuccess = vi.fn();
    const onClick = vi.fn();
    mount(
      <TapButton success onSuccess={onSuccess} onClick={onClick}>
        +
      </TapButton>,
    );
    click();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('NO dispara onSuccess sin la prop success', () => {
    const onSuccess = vi.fn();
    mount(<TapButton onSuccess={onSuccess}>ok</TapButton>);
    click();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('aplica la variante passthrough (mismos tokens que AnimatedButton)', () => {
    mount(<TapButton variant="gradient">x</TapButton>);
    const btn = container!.querySelector('button') as HTMLElement;
    expect(btn.className).toContain('bg-kiwi-gradient');
  });

  it('disabled no dispara nada', () => {
    const onClick = vi.fn();
    mount(
      <TapButton success disabled onClick={onClick}>
        +
      </TapButton>,
    );
    click();
    expect(onClick).not.toHaveBeenCalled();
  });
});
