import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCount } from '../lib/format';
import type { Video } from '../lib/types';
import { colors, font, space } from '../theme';
import { Avatar } from './Avatar';

interface Props {
  video: Video;
  isMine: boolean;
  onAuthor: () => void;
  onFollow: () => void;
  onLike: () => void;
  onComments: () => void;
  onSave: () => void;
  onShare: () => void;
}

/** Right-hand column: author avatar, heart, comments, bookmark, repost. */
export function ActionRail({ video, isMine, onAuthor, onFollow, onLike, onComments, onSave, onShare }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const wasLiked = useRef(video.likedByMe);

  useEffect(() => {
    if (video.likedByMe && !wasLiked.current) {
      pulse.setValue(0.6);
      Animated.spring(pulse, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }).start();
    }
    wasLiked.current = video.likedByMe;
  }, [video.likedByMe, pulse]);

  return (
    <View style={styles.rail}>
      <View style={styles.avatarWrap}>
        <Avatar user={video.author} size={48} ring onPress={onAuthor} />
        {!isMine && !video.followingAuthor ? (
          <Pressable style={styles.plus} onPress={onFollow} hitSlop={8} accessibilityLabel="Подписаться">
            <Ionicons name="add" size={14} color={colors.onAccent} />
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.action} onPress={onLike} accessibilityLabel={video.likedByMe ? 'Убрать лайк' : 'Лайк'}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Ionicons name="heart" size={36} color={video.likedByMe ? colors.like : colors.text} style={styles.shadow} />
        </Animated.View>
        <Text style={styles.count}>{formatCount(video.likeCount)}</Text>
      </Pressable>

      <Pressable style={styles.action} onPress={onComments} accessibilityLabel="Комментарии">
        <Ionicons name="chatbubble-ellipses" size={32} color={colors.text} style={styles.shadow} />
        <Text style={styles.count}>{formatCount(video.commentCount)}</Text>
      </Pressable>

      <Pressable style={styles.action} onPress={onSave} accessibilityLabel={video.savedByMe ? 'Убрать из избранного' : 'В избранное'}>
        <Ionicons name="bookmark" size={30} color={video.savedByMe ? colors.accent : colors.text} style={styles.shadow} />
        <Text style={styles.count}>{formatCount(video.saveCount)}</Text>
      </Pressable>

      <Pressable style={styles.action} onPress={onShare} accessibilityLabel="Репост">
        <Ionicons name="arrow-redo" size={32} color={colors.text} style={styles.shadow} />
        <Text style={styles.count}>{formatCount(video.shareCount)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { alignItems: 'center', gap: space.lg },
  avatarWrap: { marginBottom: space.sm, alignItems: 'center' },
  plus: {
    position: 'absolute',
    bottom: -9,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { alignItems: 'center', minWidth: 48 },
  count: {
    color: colors.text,
    fontSize: font.xs + 1,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  shadow: { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 4 },
});
