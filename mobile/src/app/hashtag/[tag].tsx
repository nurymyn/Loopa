import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VideoListScreen } from '../../components/VideoListScreen';
import { api } from '../../lib/api';
import { formatCount, plural } from '../../lib/format';
import type { Page, Video } from '../../lib/types';
import { usePaged } from '../../lib/usePaged';
import { colors, font, radius, space } from '../../theme';

export default function HashtagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const [stats, setStats] = useState<{ videoCount: number; viewCount: number } | null>(null);
  const list = usePaged<Video>(
    useCallback(
      async (c: string | null): Promise<Page<Video>> => {
        const r = await api.hashtag(String(tag), c);
        if (!c) setStats({ videoCount: r.videoCount, viewCount: r.viewCount });
        return r;
      },
      [tag],
    ),
  );
  useEffect(() => {
    list.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  return (
    <VideoListScreen
      title={`#${tag}`}
      items={list.items}
      error={list.error}
      refreshing={list.refreshing}
      loadingMore={list.loadingMore}
      onRefresh={list.refresh}
      onRetry={list.reload}
      onEndReached={list.loadMore}
      header={
        <View style={styles.head}>
          <View style={styles.badge}>
            <Text style={styles.hash}>#</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>#{tag}</Text>
            {stats ? (
              <Text style={styles.sub}>
                {stats.videoCount} {plural(stats.videoCount, ['видео', 'видео', 'видео'])} · {formatCount(stats.viewCount)} просмотров
              </Text>
            ) : null}
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  badge: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  hash: { color: colors.accent, fontSize: 40, fontWeight: '800' },
  title: { color: colors.text, fontSize: font.xl, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: font.sm, marginTop: space.xs },
});
