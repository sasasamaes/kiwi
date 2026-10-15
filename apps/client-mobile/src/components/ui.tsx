import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@kiwi/mobile-ui';

export function Header({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="volver"
        onPress={() => router.back()}
        style={styles.back}
      >
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        style={[styles.input, multiline ? styles.inputMultiline : null]}
      />
    </View>
  );
}

export function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.pill, active ? styles.pillActive : null]}
    >
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  sectionTitle: {
    color: tokens.color.ink,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  muted: { color: tokens.color.muted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center' },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  back: { width: 32 },
  backText: { color: tokens.color.muted, fontSize: 22 },
  title: { color: tokens.color.ink, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  right: { width: 32, alignItems: 'flex-end' },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
  },
  fieldLabel: { color: tokens.color.muted, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: tokens.color.canvas,
    color: tokens.color.ink,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    marginRight: 8,
  },
  pillActive: { backgroundColor: tokens.color.kiwi, borderColor: tokens.color.kiwi },
  pillText: { color: tokens.color.ink, fontSize: 13 },
  pillTextActive: { color: '#04140a', fontWeight: '700' },
});
