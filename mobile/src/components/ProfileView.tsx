import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { API_URL, api, describeError } from '../lib/api';
import { formatCount } from '../lib/format';
import type { Profile, ProfileTab, Video } from '../lib/types';
import { colors, font, radius, space } from '../theme';
import { Avatar } from './Avatar';
import { EmptyState, ErrorState } from './ErrorState';
import { FollowButton } from './PersonRow';
import { GridSkeleton, Skeleton } from './Skeleton';
import { VideoGrid } from './VideoGrid';

type Tab = ProfileTab;

const TAB_ICONS: Record<Tab, keyof typeof Ionicons.glyphMap> = {
  videos: 'grid-outline',
  saved: 'bookmark-outline',
  liked: 'heart-outline',
  reposts: 'repeat-outline',
};
const TAB_LABELS: Record<Tab, string> = { videos: 'Видео', saved: 'Избранное', liked: 'Понравившиеся', reposts: 'Репосты' };
const EMPTY: Record<Tab, string> = {
  videos: 'Здесь пока нет видео',
  saved: 'Сохраняйте видео закладкой, они появятся здесь',
  liked: 'Понравившиеся видео появятся здесь',
  reposts: 'Репосты появятся здесь',
};

export function ProfileView({ handle, topInset }: { handle: string; topInset: number }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>('videos');
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await api.profile(handle));
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  }, [handle]);

  const loadTab = useCallback(
    async (t: Tab) => {
      try {
        const page = await api.userVideos(handle, t);
        setVideos(page.items);
        setCursor(page.nextCursor);
      } catch {
        setVideos([]);
        setCursor(null);
      }
    },
    [handle],
  );

  // Refresh whenever the screen comes back into view (likes/saves may have changed).
  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadTab(tab);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadProfile, loadTab]),
  );

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    setVideos(null);
    loadTab(t);
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.userVideos(handle, tab, cursor);
      setVideos((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadTab(tab)]);
    setRefreshing(false);
  };

  const toggleFollow = () => {
    if (!profile) return;
    const on = !profile.isFollowing;
    setProfile({ ...profile, isFollowing: on, followerCount: profile.followerCount + (on ? 1 : -1) });
    api.follow(profile.handle, on).catch(loadProfile);
  };

  const shareProfile = () => {
    if (!profile) return;
    Share.share({ message: `${profile.displayName} (@${profile.handle}) в Loopa — ${API_URL}` }).catch(() => {});
  };

  if (error && !profile) return <ErrorState message={error} onRetry={loadProfile} />;

  const tabs: Tab[] = profile?.isMe ? ['videos', 'reposts', 'saved', 'liked'] : ['videos', 'reposts', 'liked'];
  const openPeople = (kind: 'followers' | 'following') =>
    profile && router.push({ pathname: '/people/[handle]', params: { handle: profile.handle, kind } });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: space.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}
      scrollEventThrottle={200}
      onScroll={({ nativeEvent: n }) => {
        if (n.layoutMeasurement.height + n.contentOffset.y >= n.contentSize.height - 400) loadMore();
      }}
    >
      {profile ? (
        <View style={styles.header}>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Avatar user={profile} size={96} />
          <Text style={styles.handle}>@{profile.handle}</Text>

          <View style={styles.stats}>
            <Stat value={profile.followingCount} label="Подписки" onPress={() => openPeople('following')} />
            <View style={styles.statDivider} />
            <Stat value={profile.followerCount} label="Подписчики" onPress={() => openPeople('followers')} />
            <View style={styles.statDivider} />
            <Stat value={profile.likeCount} label="Лайки" />
          </View>

          <View style={styles.buttons}>
            {profile.isMe ? (
              <Pressable style={styles.button} onPress={() => router.push('/edit-profile')}>
                <Text style={styles.buttonText}>Изменить профиль</Text>
              </Pressable>
            ) : (
              <FollowButton
                following={profile.isFollowing}
                onPress={toggleFollow}
                label={profile.followsYou ? 'Взаимно' : 'Подписаться'}
              />
            )}
            <Pressable style={styles.button} onPress={shareProfile}>
              <Text style={styles.buttonText}>Поделиться профилем</Text>
            </Pressable>
          </View>

          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        </View>
      ) : (
        <View style={styles.header}>
          <Skeleton width={140} height={18} />
          <Skeleton width={96} height={96} round style={{ marginTop: space.md }} />
          <Skeleton width={200} height={14} style={{ marginTop: space.lg }} />
        </View>
      )}

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => switchTab(t)} accessibilityLabel={TAB_LABELS[t]}>
            <Ionicons name={TAB_ICONS[t]} size={20} color={tab === t ? colors.text : colors.textFaint} />
            <Text style={[styles.tabText, tab === t && { color: colors.text }]} numberOfLines={1}>
              {TAB_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </View>

      {videos === null ? (
        <GridSkeleton cells={6} />
      ) : videos.length === 0 ? (
        <View style={{ height: 220 }}>
          <EmptyState icon={TAB_ICONS[tab]} text={EMPTY[tab]} />
        </View>
      ) : (
        <VideoGrid
          videos={videos}
          onOpen={(index) =>
            router.push({ pathname: '/video/[id]', params: { id: String(videos[index].id), handle, list: tab, index: String(index) } })
          }
        />
      )}
      {loadingMore ? <ActivityIndicator color={colors.text} style={{ marginTop: space.lg }} /> : null}
    </ScrollView>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress}>
      <Text style={styles.statValue}>{formatCount(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  name: { color: colors.text, fontSize: font.lg, fontWeight: '700', marginBottom: space.sm },
  handle: { color: colors.text, fontSize: font.md, fontWeight: '600', marginTop: space.xs },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  stat: { alignItems: 'center', width: 96 },
  statValue: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  statLabel: { color: colors.textMuted, fontSize: font.sm, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: colors.border },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  button: { backgroundColor: colors.surfaceRaised, paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.sm },
  buttonText: { color: colors.text, fontWeight: '600', fontSize: font.sm },
  bio: { color: colors.text, fontSize: font.sm + 1, textAlign: 'center', marginTop: space.sm, lineHeight: 19 },
  tabs: { flexDirection: 'row', marginTop: space.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.sm + 2, gap: 2, borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive: { borderColor: colors.text },
  tabText: { color: colors.textFaint, fontSize: font.xs },
});
