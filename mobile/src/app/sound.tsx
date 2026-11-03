import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VideoListScreen } from '../components/VideoListScreen';
import { api } from '../lib/api';
import type { Page, Video } from '../lib/types';
import { usePaged } from '../lib/usePaged';
import { colors, font, radius, space } from '../theme';

/** Every video that uses a sound. */
export default function SoundScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const [count, setCount] = useState<number | null>(null);
  const list = usePaged<Video>(
    useCallback(
      async (c: string | null): Promise<Page<Video>> => {
        const r = await api.sound(String(name), c);
        if (!c) setCount(r.videoCount);
        return r;
      },
      [name],
    ),
  );
  useEffect(() => {
    list.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return (
    <VideoListScreen
      title="Звук"
      items={list.items}
      error={list.error}
      refreshing={list.refreshing}
      loadingMore={list.loadingMore}
      onRefresh={list.refresh}
      onRetry={list.reload}
      onEndReached={list.loadMore}
      header={
        <View style={styles.head}>
          <View style={styles.disc}>
            <Ionicons name="musical-notes" size={32} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {name}
            </Text>
            {count !== null ? <Text style={styles.sub}>Видео с этим звуком: {count}</Text> : null}
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  disc: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: font.sm, marginTop: space.xs },
});
