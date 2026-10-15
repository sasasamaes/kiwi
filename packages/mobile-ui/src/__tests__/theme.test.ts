import { tokens } from '../theme';

test('exposes the DESIGN.md brand colors', () => {
  expect(tokens.color.kiwi).toBe('#22c55e');
  expect(tokens.color.canvas).toBe('#0b1326');
  expect(tokens.color.amber).toBe('#f59e0b');
});

test('has a positive spacing scale', () => {
  expect(tokens.space[4]).toBe(16);
  expect(tokens.space[6]).toBe(24);
});
