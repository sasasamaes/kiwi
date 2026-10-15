import { Text } from 'react-native';
import { tokens } from '../theme';

export function Price({ amount, size = 16 }: { amount: number; size?: number }) {
  const n = Number.isFinite(amount) ? amount : 0;
  return (
    <Text style={{ color: tokens.color.ink, fontSize: size, fontWeight: '700' }}>
      {'₡' + n.toLocaleString('es-CR')}
    </Text>
  );
}
