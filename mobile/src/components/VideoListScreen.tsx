import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import type { Video } from '../lib/types';
import { colors, space } from '../theme';
import { BackHeader } from './BackHeader';
import { EmptyState, ErrorState } from './ErrorState';
import { GridSkeleton } from './Skeleton';
import { VideoGrid } from './VideoGrid';

/** Shared layout for hashtag and sound pages: header block + infinite grid. */
export function VideoListScreen({
  title,
  header,
  items,
  error,
  refreshing,
  loadingMore,
  onRefresh,
  onRetry,
  onEndReached,
}: {
  title: string;
  header: ReactNode;
  items: Video[] | null;
  error: string | null;
  refreshing: boolean;
  loadingMore: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onEndReached: () => void;
}) {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackHeader title={title} />
      {error && !items ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          scrollEventThrottle={200}
          onScroll={({ nativeEvent: n }) => {
            if (n.layoutMeasurement.height + n.contentOffset.y >= n.contentSize.height - 400) onEndReached();
          }}
        >
          {header}
          {!items ? (
            <GridSkeleton />
          ) : items.length === 0 ? (
            <View style={{ height: 240 }}>
              <EmptyState icon="film-outline" text="Видео пока нет" />
            </View>
          ) : (
            <VideoGrid
              videos={items}
              onOpen={(i) => router.push({ pathname: '/video/[id]', params: { id: String(items[i].id) } })}
            />
          )}
          {loadingMore ? <ActivityIndicator color={colors.text} style={{ margin: space.lg }} /> : null}
        </ScrollView>
      )}
    </View>
  );
}
