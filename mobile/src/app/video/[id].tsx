import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '../../components/BackHeader';
import { ErrorState } from '../../components/ErrorState';
import { FeedSkeleton } from '../../components/Skeleton';
import { VideoFeed } from '../../components/VideoFeed';
import { api, describeError } from '../../lib/api';
import type { ProfileTab, Video } from '../../lib/types';
import { useFocused } from '../../lib/useFocused';
import { colors } from '../../theme';

/**
 * Opens one video full screen. When opened from a profile grid it gets the
 * whole grid (handle + list + index), so you can keep swiping through it.
 */
export default function VideoScreen() {
  const params = useLocalSearchParams<{ id: string; handle?: string; list?: ProfileTab; index?: string }>();
  const insets = useSafeAreaInsets();
  const focused = useFocused();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [initialIndex, setInitialIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const id = Number(params.id);
    const load = async () => {
      if (params.handle && params.list) {
        const { items } = await api.userVideos(params.handle, params.list);
        const at = items.findIndex((v) => v.id === id);
        if (at >= 0) {
          setInitialIndex(at);
          return items;
        }
      }
      return [await api.video(id)];
    };
    load()
      .then(setVideos)
      .catch((err) => setError(describeError(err)));
  }, [params.id, params.handle, params.list, attempt]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {error ? (
        <ErrorState message={error} onRetry={() => { setError(null); setAttempt((n) => n + 1); }} />
      ) : !videos ? (
        <FeedSkeleton />
      ) : (
        <VideoFeed
          videos={videos}
          setVideos={(u) => setVideos((prev) => (typeof u === 'function' ? u(prev ?? []) : u))}
          focused={focused}
          initialIndex={initialIndex}
          bottomInset={insets.bottom}
        />
      )}
      <BackHeader overlay />
    </View>
  );
}
