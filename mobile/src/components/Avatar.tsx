import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { UserSummary } from '../lib/types';
import { colors } from '../theme';

interface Props {
  user: Pick<UserSummary, 'displayName' | 'handle' | 'avatarColor'> & { avatarUrl?: string | null };
  size?: number;
  onPress?: () => void;
  ring?: boolean;
}

/** Round avatar: the uploaded photo, or the user's colour with their initial. */
export function Avatar({ user, size = 40, onPress, ring }: Props) {
  const initial = (user.displayName || user.handle).trim().charAt(0).toUpperCase();
  const body = (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: user.avatarColor,
          borderWidth: ring ? 2 : 0,
        },
      ]}
    >
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={120} />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
      )}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Профиль @${user.handle}`}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderColor: colors.text, overflow: 'hidden' },
  initial: { color: colors.onAccent, fontWeight: '700' },
});
