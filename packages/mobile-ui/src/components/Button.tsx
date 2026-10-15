import { ActivityIndicator, Pressable, Text } from 'react-native';
import { tokens } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';
export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { label, onPress, variant = 'primary', loading = false, disabled = false } = props;
  const bg =
    variant === 'primary'
      ? tokens.color.kiwi
      : variant === 'danger'
        ? tokens.color.danger
        : tokens.color.surface;
  const fg = variant === 'secondary' ? tokens.color.ink : '#04140a';
  const blocked = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (!blocked) onPress();
      }}
      style={{
        backgroundColor: bg,
        borderRadius: tokens.radius.lg,
        paddingVertical: 14,
        opacity: blocked ? 0.5 : 1,
        alignItems: 'center',
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '700' }}>{label}</Text>
      )}
    </Pressable>
  );
}
