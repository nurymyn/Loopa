import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { EmptyState, ErrorState } from '../../components/ErrorState';
import { FollowButton } from '../../components/PersonRow';
import { ListSkeleton } from '../../components/Skeleton';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { usePaged } from '../../lib/usePaged';
import { timeAgo } from '../../lib/format';
import type { Notification } from '../../lib/types';
import { colors, font, radius, space } from '../../theme';

function describe(n: Notification): string {
  switch (n.type) {
    case 'like':
      return 'понравилось ваше видео';
    case 'follow':
      return 'подписался(ась) на вас';
    case 'comment':
      return `прокомментировал(а): ${n.commentBody ?? ''}`;
    case 'repost':
      return 'сделал(а) репост вашего видео';
    case 'reply':
      return `ответил(а) на ваш комментарий: ${n.commentBody ?? ''}`;
  }
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clearUnread } = useSession();
  const list = usePaged<Notification>(useCallback((c: string | null) => api.inbox(c), []));
  const { items, setItems, error, reload: load } = list;

  // Opening the tab marks everything as read and clears the badge.
  useFocusEffect(
    useCallback(() => {
      load().then(() => {
        api
          .markInboxRead()
          .then(clearUnread)
          .catch(() => {});
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const followBack = (n: Notification) => {
    const on = !n.iFollowActor;
    setItems((list) => list?.map((x) => (x.actor.id === n.actor.id ? { ...x, iFollowActor: on } : x)) ?? null);
    api.follow(n.actor.handle, on).catch(load);
  };

  const open = (n: Notification) => {
    if (n.videoId) router.push({ pathname: '/video/[id]', params: { id: String(n.videoId) } });
    else router.push(`/user/${n.actor.handle}`);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Входящие</Text>
      {error && !items ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          refreshControl={<RefreshControl refreshing={list.refreshing} tintColor={colors.text} onRefresh={list.refresh} />}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.text} style={{ margin: space.lg }} /> : undefined}
          ListEmptyComponent={<EmptyState icon="notifications-outline" text="Здесь появятся лайки, комментарии и подписки" />}
          renderItem={({ item: n }) => (
            <Pressable style={[styles.row, !n.read && styles.unread]} onPress={() => open(n)}>
              <Avatar user={n.actor} size={44} onPress={() => router.push(`/user/${n.actor.handle}`)} />
              <View style={styles.text}>
                <Text style={styles.line} numberOfLines={2}>
                  <Text style={styles.actor}>{n.actor.displayName} </Text>
                  {describe(n)}
                </Text>
                <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
              </View>
              {n.type === 'follow' ? (
                <FollowButton following={n.iFollowActor} onPress={() => followBack(n)} label="Взаимно" />
              ) : n.videoThumbnailUrl ? (
                <Image source={{ uri: n.videoThumbnailUrl }} style={styles.thumb} contentFit="cover" />
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center', paddingVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  unread: { backgroundColor: 'rgba(184,242,39,0.06)' },
  text: { flex: 1 },
  line: { color: colors.text, fontSize: font.sm + 1, lineHeight: 19 },
  actor: { fontWeight: '700' },
  time: { color: colors.textFaint, fontSize: font.sm - 1, marginTop: 3 },
  thumb: { width: 44, height: 58, borderRadius: radius.sm - 2, backgroundColor: colors.surfaceRaised },
});
