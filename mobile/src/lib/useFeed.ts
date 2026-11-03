import { useCallback, useRef, useState } from 'react';
import { describeError } from './api';
import type { Page, Video } from './types';

let seq = 0;
/** Give every list entry its own key: one video may appear twice in a looping feed. */
export function withKeys(items: Video[]): Video[] {
  return items.map((v) => ({ ...v, listKey: `${v.id}:${++seq}` }));
}

/** Cursor-paginated list of videos with loading / error / refresh state. */
export function useFeed(fetchPage: (cursor: string | null) => Promise<Page<Video>>) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursor = useRef<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (busy.current) return;
      busy.current = true;
      if (mode === 'initial') setStatus('loading');
      else setRefreshing(true);
      try {
        const page = await fetchPage(null);
        cursor.current = page.nextCursor;
        setVideos(withKeys(page.items));
        setStatus('ready');
      } catch (err) {
        setError(describeError(err));
        if (mode === 'initial') setStatus('error');
      } finally {
        busy.current = false;
        setRefreshing(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (busy.current || !cursor.current) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor.current);
      cursor.current = page.nextCursor;
      // The for-you feed loops, so the same video can come back later on.
      setVideos((prev) => [...prev, ...withKeys(page.items)]);
    } catch {
      // Silent: the user can keep scrolling to retry.
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage]);

  return { videos, setVideos, status, error, refreshing, loadingMore, load, loadMore };
}
