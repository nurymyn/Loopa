import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCount, plural } from '../lib/format';
import type { Person } from '../lib/types';
import { colors, font, radius, space } from '../theme';
import { Avatar } from './Avatar';

interface Props {
  person: Person;
  onOpen: () => void;
  onToggleFollow: () => void;
  /** Label for the button when not following yet. */
  followLabel?: string;
}

export function PersonRow({ person, onOpen, onToggleFollow, followLabel = 'Подписаться' }: Props) {
  return (
    <Pressable style={styles.row} onPress={onOpen}>
      <Avatar user={person} size={48} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {person.displayName}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          @{person.handle} · {formatCount(person.followerCount)}{' '}
          {plural(person.followerCount, ['подписчик', 'подписчика', 'подписчиков'])}
        </Text>
      </View>
      <FollowButton following={person.isFollowing} onPress={onToggleFollow} label={followLabel} />
    </Pressable>
  );
}

export function FollowButton({ following, onPress, label = 'Подписаться' }: { following: boolean; onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, following ? styles.buttonOff : styles.buttonOn]}
      hitSlop={6}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonText, { color: following ? colors.text : colors.onAccent }]}>
        {following ? 'Вы подписаны' : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm + 2, gap: space.md },
  text: { flex: 1 },
  name: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  button: { paddingHorizontal: space.md + 2, paddingVertical: space.sm, borderRadius: radius.sm, minWidth: 112, alignItems: 'center' },
  buttonOn: { backgroundColor: colors.accent },
  buttonOff: { backgroundColor: colors.surfaceRaised },
  buttonText: { fontSize: font.sm, fontWeight: '700' },
});
