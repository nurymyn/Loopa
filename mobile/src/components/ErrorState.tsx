import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';

/** Shown instead of content when the API is unreachable or fails. Never crashes the screen. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
      <Text style={styles.text}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.buttonText}>Повторить</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={40} color={colors.textFaint} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md },
  text: { color: colors.textMuted, fontSize: font.md, textAlign: 'center', lineHeight: 21 },
  button: {
    marginTop: space.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  buttonText: { color: colors.onAccent, fontWeight: '700', fontSize: font.md },
});
