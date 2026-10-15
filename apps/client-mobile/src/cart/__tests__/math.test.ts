import { unitPriceFor, cartSubtotal, lineTotal } from '../math';

test('unitPrice adds option prices to base', () => {
  expect(
    unitPriceFor(4500, [
      { optionId: 'a', price: 300 },
      { optionId: 'b', price: 200 },
    ]),
  ).toBe(5000);
});

test('unitPrice with no options is the base price', () => {
  expect(unitPriceFor(4500)).toBe(4500);
});

test('lineTotal multiplies unit price by quantity', () => {
  expect(lineTotal({ unitPrice: 5000, quantity: 3 })).toBe(15000);
});

test('cartSubtotal multiplies by quantity', () => {
  expect(
    cartSubtotal([
      { unitPrice: 5000, quantity: 2 },
      { unitPrice: 1500, quantity: 1 },
    ]),
  ).toBe(11500);
});
