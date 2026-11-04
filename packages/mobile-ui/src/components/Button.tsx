import { ActivityIndicator, Pressable, Text } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger';
export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { label, onPress, variant = 'primary', loading = false, disabled = false } = props;
  const blocked = loading || disabled;
  const bg =
    variant === 'primary'
      ? 'bg-kiwi-700'
      : variant === 'danger'
        ? 'bg-red-600'
        : 'bg-surface-100 dark:bg-surface-700';
  const fg = variant === 'secondary' ? 'text-surface-800 dark:text-surface-100' : 'text-white';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (!blocked) onPress();
      }}
      className={`items-center rounded-xl py-3.5 ${bg} ${blocked ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#52525b' : '#fff'} />
      ) : (
        <Text className={`font-bold ${fg}`}>{label}</Text>
      )}
    </Pressable>
  );
}
