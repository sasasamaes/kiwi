import { Pressable, Text, View } from 'react-native';
import { tokens } from '../theme';

export function QtyStepper({
  value,
  min = 0,
  max = 99,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="disminuir"
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text style={{ color: tokens.color.ink, fontSize: 22 }}>−</Text>
      </Pressable>
      <Text style={{ color: tokens.color.ink, minWidth: 20, textAlign: 'center' }}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="aumentar"
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <Text style={{ color: tokens.color.ink, fontSize: 22 }}>+</Text>
      </Pressable>
    </View>
  );
}
