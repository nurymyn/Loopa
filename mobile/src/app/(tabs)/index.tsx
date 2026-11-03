import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState } from '../../components/ErrorState';
import { FeedSkeleton } from '../../components/Skeleton';
import { VideoFeed } from '../../components/VideoFeed';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useFeed, withKeys } from '../../lib/useFeed';
import { useFocused } from '../../lib/useFocused';
import { colors, font, space } from '../../theme';

type FeedTab = 'following' | 'foryou';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const focused = useFocused();
  const { lastPublished } = useSession();
  const [tab, setTab] = useState<FeedTab>('foryou');
  const [topKey, setTopKey] = useState(0);

  const forYou = useFeed(useCallback((c: string | null) => api.forYou(c), []));
  const following = useFeed(useCallback((c: string | null) => api.following(c), []));
  const feed = tab === 'foryou' ? forYou : following;

  useEffect(() => {
    if (feed.status === 'idle') feed.load('initial');
  }, [feed]);

  // A freshly published video goes first in "Для вас".
  useEffect(() => {
    if (!lastPublished) return;
    setTab('foryou');
    forYou.setVideos((list) => [...withKeys([lastPublished]), ...list.filter((v) => v.id !== lastPublished.id)]);
    setTopKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPublished]);

  // Hidden screen: triple tap on the logo shows what the algorithm learned.
  const taps = useRef<number[]>([]);
  const onLogo = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 600), now];
    if (taps.current.length >= 3) {
      taps.current = [];
      router.push('/interests');
    }
  };

  let body;
  if (feed.status === 'loading' || feed.status === 'idle') body = <FeedSkeleton />;
  else if (feed.status === 'error') body = <ErrorState message={feed.error} onRetry={() => feed.load('initial')} />;
  else if (feed.videos.length === 0)
    body =
      tab === 'following' ? (
        <EmptyState icon="people-outline" text="Подпишитесь на авторов, и их новые видео появятся здесь" />
      ) : (
        <EmptyState icon="film-outline" text="Видео пока нет. Опубликуйте первое через «+»" />
      );
  else
    body = (
      <VideoFeed
        key={tab}
        videos={feed.videos}
        setVideos={feed.setVideos}
        focused={focused}
        onEndReached={feed.loadMore}
        loadingMore={feed.loadingMore}
        refreshing={feed.refreshing}
        onRefresh={() => feed.load('refresh')}
        scrollToTopKey={tab === 'foryou' ? topKey : undefined}
      />
    );

  return (
    <View style={styles.screen}>
      {body}
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <Pressable onPress={onLogo} hitSlop={10} style={styles.side}>
          <Text style={styles.logo}>loopa</Text>
        </Pressable>
        <View style={styles.tabs}>
          <TopTab label="Подписки" active={tab === 'following'} onPress={() => setTab('following')} />
          <View style={styles.sep} />
          <TopTab label="Для вас" active={tab === 'foryou'} onPress={() => setTab('foryou')} />
        </View>
        <Pressable onPress={() => router.push('/search')} hitSlop={10} style={[styles.side, { alignItems: 'flex-end' }]} accessibilityLabel="Поиск">
          <Ionicons name="search" size={24} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function TopTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.topTab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <Text style={[styles.topTabText, active && styles.topTabActive]}>{label}</Text>
      <View style={[styles.underline, { opacity: active ? 1 : 0 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  side: { width: 64 },
  logo: { color: colors.accent, fontWeight: '800', fontSize: font.lg, letterSpacing: -0.5 },
  tabs: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.md },
  sep: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.35)' },
  topTab: { alignItems: 'center' },
  topTabText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: font.md + 1,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  topTabActive: { color: colors.text, fontWeight: '700' },
  underline: { marginTop: 4, width: 24, height: 2.5, borderRadius: 2, backgroundColor: colors.text },
});
