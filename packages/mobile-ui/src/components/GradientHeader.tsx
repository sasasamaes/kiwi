import { ReactNode } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Header degradado kiwi 700→900 con círculos decorativos (par PWA). */
export function GradientHeader({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={['#195a77', '#0d3345']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="relative overflow-hidden rounded-3xl p-6"
    >
      <View className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
      <View className="absolute -bottom-5 -left-5 h-20 w-20 rounded-full bg-white/10" />
      <View className="relative">{children}</View>
    </LinearGradient>
  );
}
