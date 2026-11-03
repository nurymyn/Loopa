import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, space } from '../theme';

export function BackHeader({ title, right, overlay, icon = 'chevron-back' }: { title?: string; right?: ReactNode; overlay?: boolean; icon?: 'chevron-back' | 'close' }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.xs }, overlay && styles.overlay]} pointerEvents="box-none">
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.side} accessibilityLabel="Назад">
        <Ionicons name={icon} size={28} color={colors.text} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingBottom: space.sm, backgroundColor: colors.bg },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'transparent', zIndex: 10 },
  side: { width: 56 },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontWeight: '700', fontSize: font.lg },
});
