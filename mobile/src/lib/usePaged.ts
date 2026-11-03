import { useCallback, useRef, useState } from 'react';
import { describeError } from './api';
import type { Page } from './types';

/** Generic cursor-paginated list: first page, refresh, load more. */
export function usePaged<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursor = useRef<string | null>(null);
  const busy = useRef(false);

  const reload = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const page = await fetchPage(null);
      cursor.current = page.nextCursor;
      setItems(page.items);
      setError(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      busy.current = false;
    }
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (busy.current || !cursor.current) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor.current);
      cursor.current = page.nextCursor;
      setItems((prev) => [...(prev ?? []), ...page.items]);
    } catch {
      // keep what we have; scrolling again retries
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage]);

  return { items, setItems, error, refreshing, loadingMore, reload, refresh, loadMore };
}
