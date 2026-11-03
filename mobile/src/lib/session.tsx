import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ApiError, api, describeError, setToken } from './api';
import { KEYS, storage } from './storage';
import type { Me, Video } from './types';

const UNREAD_POLL_MS = 30_000;

interface Session {
  /** loading: restoring the saved token; signedOut: show login; error: API unreachable. */
  status: 'loading' | 'ready' | 'signedOut' | 'error';
  error: string | null;
  me: Me | null;
  retry: () => void;
  signIn: (token: string, user: Me) => Promise<void>;
  signOut: () => Promise<void>;
  /** Dev only: become another seeded user (no password). */
  switchAccount: (handle: string) => Promise<void>;
  setMe: (me: Me) => void;
  /** Set after a successful publish; the home feed puts it first. */
  lastPublished: Video | null;
  announcePublished: (v: Video) => void;
  /** App-wide sound switch for the feed. */
  muted: boolean;
  setMuted: (m: boolean) => void;
  unreadCount: number;
  refreshUnread: () => void;
  clearUnread: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Session['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [lastPublished, setLastPublished] = useState<Video | null>(null);
  const [muted, setMutedState] = useState(false);
  const [unreadCount, setUnread] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  // Restore the saved session on start (and on "Повторить").
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      storage.get(KEYS.muted).then((m) => !cancelled && setMutedState(m === '1')).catch(() => {});
      const saved = await storage.get(KEYS.token).catch(() => null);
      if (!saved) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      setToken(saved);
      try {
        const user = await api.me();
        if (cancelled) return;
        setMe(user);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          await storage.remove(KEYS.token).catch(() => {});
          setToken(null);
          setStatus('signedOut');
        } else {
          setError(describeError(err));
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const signIn = useCallback(async (token: string, user: Me) => {
    setToken(token);
    await storage.set(KEYS.token, token).catch(() => {});
    setMe(user);
    setStatus('ready');
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => {});
    await storage.remove(KEYS.token).catch(() => {});
    setToken(null);
    setMe(null);
    setUnread(0);
    setStatus('signedOut');
  }, []);

  const switchAccount = useCallback(
    async (handle: string) => {
      const { token, user } = await api.devLogin(handle);
      await signIn(token, user);
    },
    [signIn],
  );

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    storage.set(KEYS.muted, m ? '1' : '0').catch(() => {});
  }, []);

  const refreshUnread = useCallback(() => {
    if (statusRef.current !== 'ready') return;
    api
      .unread()
      .then((r) => setUnread(r.count))
      .catch(() => {});
  }, []);

  // Badge: poll while the app is in the foreground, and refresh on return.
  useEffect(() => {
    if (status !== 'ready') return;
    refreshUnread();
    const timer = setInterval(refreshUnread, UNREAD_POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshUnread());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [status, me?.id, refreshUnread]);

  const value = useMemo<Session>(
    () => ({
      status,
      error,
      me,
      retry: () => setAttempt((n) => n + 1),
      signIn,
      signOut,
      switchAccount,
      setMe,
      lastPublished,
      announcePublished: setLastPublished,
      muted,
      setMuted,
      unreadCount,
      refreshUnread,
      clearUnread: () => setUnread(0),
    }),
    [status, error, me, signIn, signOut, switchAccount, lastPublished, muted, setMuted, unreadCount, refreshUnread],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}
