import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useAppActive } from '../lib/useAppActive';
import { useSession } from '../lib/session';
import type { Video } from '../lib/types';
import { colors } from '../theme';
import { CommentsSheet } from './CommentsSheet';
import { ShareSheet } from './ShareSheet';
import { VideoItem } from './VideoItem';

interface Props {
  videos: Video[];
  setVideos: Dispatch<SetStateAction<Video[]>>;
  /** Screen is focused (tab visible, no modal on top). */
  focused: boolean;
  onEndReached?: () => void;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  initialIndex?: number;
  /** Extra bottom padding for the caption block (e.g. no tab bar under it). */
  bottomInset?: number;
  /** Change this number to jump back to the first video. */
  scrollToTopKey?: number;
}

/**
 * Full-screen vertical feed. One video per "page"; the visible one plays, the
 * rest are paused. All reactions update the list optimistically and roll back
 * if the server says no.
 */
export function VideoFeed(props: Props) {
  const { videos, setVideos, focused } = props;
  const router = useRouter();
  const { me, muted, setMuted } = useSession();
  const appActive = useAppActive();
  const insets = useSafeAreaInsets();
  const [shareFor, setShareFor] = useState<Video | null>(null);
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(props.initialIndex ?? 0);
  const [commentsFor, setCommentsFor] = useState<Video | null>(null);
  const listRef = useRef<FlatList<Video>>(null);

  useEffect(() => {
    if (props.scrollToTopKey === undefined || videos.length === 0) return;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.scrollToTopKey]);

  const patch = useCallback(
    (id: number, change: Partial<Video> | ((v: Video) => Partial<Video>)) =>
      setVideos((list) => list.map((v) => (v.id === id ? { ...v, ...(typeof change === 'function' ? change(v) : change) } : v))),
    [setVideos],
  );

  const patchAuthor = useCallback(
    (authorId: number, followingAuthor: boolean) =>
      setVideos((list) => list.map((v) => (v.author.id === authorId ? { ...v, followingAuthor } : v))),
    [setVideos],
  );

  const onLike = useCallback(
    (video: Video, on: boolean) => {
      patch(video.id, (v) => ({ likedByMe: on, likeCount: v.likeCount + (on ? 1 : -1) }));
      api
        .like(video.id, on)
        .then((c) => patch(video.id, { likedByMe: c.liked, likeCount: c.likeCount }))
        .catch(() => patch(video.id, { likedByMe: video.likedByMe, likeCount: video.likeCount }));
    },
    [patch],
  );

  const onSave = useCallback(
    (video: Video) => {
      const on = !video.savedByMe;
      patch(video.id, (v) => ({ savedByMe: on, saveCount: v.saveCount + (on ? 1 : -1) }));
      api
        .save(video.id, on)
        .then((c) => patch(video.id, { savedByMe: c.saved, saveCount: c.saveCount }))
        .catch(() => patch(video.id, { savedByMe: video.savedByMe, saveCount: video.saveCount }));
    },
    [patch],
  );


  const onFollow = useCallback(
    (video: Video) => {
      patchAuthor(video.author.id, true);
      api.follow(video.author.handle, true).catch(() => patchAuthor(video.author.id, false));
    },
    [patchAuthor],
  );

  const onAuthor = useCallback((handle: string) => router.push(`/user/${handle}`), [router]);
  const onTag = useCallback((tag: string) => router.push({ pathname: '/hashtag/[tag]', params: { tag } }), [router]);
  const onSound = useCallback((name: string) => router.push({ pathname: '/sound', params: { name } }), [router]);
  const onToggleMute = useCallback(() => setMuted(!muted), [muted, setMuted]);

  const viewability = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  return (
    <View style={styles.wrap} onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
      {height > 0 ? (
        <FlatList
          ref={listRef}
          data={videos}
          keyExtractor={(v) => v.listKey ?? String(v.id)}
          renderItem={({ item, index: i }) => (
            <VideoItem
              video={item}
              height={height}
              visible={i === index}
              canPlay={i === index && focused && appActive && !commentsFor && !shareFor}
              nearby={Math.abs(i - index) <= 1}
              muted={muted}
              myId={me?.id ?? null}
              topInset={insets.top}
              bottomInset={props.bottomInset ?? 0}
              onTag={onTag}
              onSound={onSound}
              onToggleMute={onToggleMute}
              onAuthor={onAuthor}
              onFollow={onFollow}
              onLike={onLike}
              onComments={setCommentsFor}
              onSave={onSave}
              onShare={setShareFor}
            />
          )}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          initialScrollIndex={props.initialIndex && props.initialIndex < videos.length ? props.initialIndex : undefined}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewability}
          onEndReached={props.onEndReached}
          onEndReachedThreshold={2}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews
          refreshing={props.refreshing ?? false}
          onRefresh={props.onRefresh}
          ListFooterComponent={
            props.loadingMore ? <ActivityIndicator color={colors.text} style={{ marginVertical: 16 }} /> : undefined
          }
        />
      ) : null}
      <ShareSheet
        video={shareFor ? (videos.find((v) => v.id === shareFor.id) ?? shareFor) : null}
        isMine={shareFor?.author.id === me?.id}
        onClose={() => setShareFor(null)}
        onUpdate={(id, change) => patch(id, change)}
      />
      <CommentsSheet
        video={commentsFor}
        onClose={() => setCommentsFor(null)}
        onTotalChange={(id, total) => patch(id, { commentCount: total })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
});
