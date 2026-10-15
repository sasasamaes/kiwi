export interface IdempotencyManager {
  keyFor(checkoutId: string): string;
  reset(checkoutId: string): void;
}

export function createIdempotencyManager(genKey: () => string): IdempotencyManager {
  const keys = new Map<string, string>();
  return {
    keyFor(checkoutId: string): string {
      let k = keys.get(checkoutId);
      if (!k) {
        k = genKey();
        keys.set(checkoutId, k);
      }
      return k;
    },
    reset(checkoutId: string) {
      keys.delete(checkoutId);
    },
  };
}
