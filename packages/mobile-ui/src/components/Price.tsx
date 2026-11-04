import { Text } from 'react-native';

export function Price({ amount, size = 16 }: { amount: number; size?: number }) {
  const n = Number.isFinite(amount) ? amount : 0;
  return (
    <Text className="font-bold text-surface-800 dark:text-surface-100" style={{ fontSize: size }}>
      {'₡' + n.toLocaleString('es-CR')}
    </Text>
  );
}
