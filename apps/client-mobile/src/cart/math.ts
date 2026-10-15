export interface SelectedOption {
  optionId: string;
  price: number;
}

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export function unitPriceFor(base: number, selected: readonly SelectedOption[] = []): number {
  const safeBase = Number.isFinite(base) ? base : 0;
  return selected.reduce((sum, o) => sum + (Number.isFinite(o.price) ? o.price : 0), safeBase);
}

export function lineTotal(line: PricedLine): number {
  const unitPrice = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
  const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
  return unitPrice * quantity;
}

export function cartSubtotal(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}
