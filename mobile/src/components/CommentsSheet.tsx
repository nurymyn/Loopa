import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api, describeError } from '../lib/api';
import { formatCount, plural, timeAgo } from '../lib/format';
import { useSession } from '../lib/session';
import type { Comment, Video } from '../lib/types';
import { colors, font, radius, space } from '../theme';
import { Avatar } from './Avatar';
import { ErrorState } from './ErrorState';
import { ListSkeleton } from './Skeleton';

interface Props {
  video: Video | null;
  onClose: () => void;
  onTotalChange: (videoId: number, total: number) => void;
}

/** Bottom sheet at 70% of the screen. Closes with the X, a tap above it, or a swipe down. */
export function CommentsSheet({ video, onClose, onTotalChange }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me } = useSession();
  const sheetHeight = Math.round(height * 0.7);

  const [items, setItems] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [replies, setReplies] = useState<Record<number, Comment[]>>({});
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const drag = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.2) {
          Animated.timing(drag, { toValue: sheetHeight, duration: 160, useNativeDriver: true }).start(() => close());
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const close = useCallback(() => {
    setReplyTo(null);
    setDraft('');
    onClose();
  }, [onClose]);

  const load = useCallback(async () => {
    if (!video) return;
    setState('loading');
    try {
      const page = await api.comments(video.id);
      setItems(page.items);
      setTotal(page.total);
      setCursor(page.nextCursor);
      setReplies({});
      setState('ready');
    } catch (err) {
      setError(describeError(err));
      setState('error');
    }
  }, [video]);

  useEffect(() => {
    if (video) {
      drag.setValue(0);
      load();
    }
  }, [video, load, drag]);

  const loadMore = async () => {
    if (!video || !cursor) return;
    try {
      const page = await api.comments(video.id, cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      // Keep what we have; the user can scroll again.
    }
  };

  const showReplies = async (c: Comment) => {
    try {
      const r = await api.replies(c.id);
      setReplies((all) => ({ ...all, [c.id]: r.items }));
    } catch {
      // ignore
    }
  };

  const toggleLike = async (c: Comment) => {
    const on = !c.likedByMe;
    const apply = (x: Comment) => (x.id === c.id ? { ...x, likedByMe: on, likeCount: x.likeCount + (on ? 1 : -1) } : x);
    setItems((list) => list.map(apply));
    setReplies((all) => Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.map(apply)])));
    api.likeComment(c.id, on).catch(() => load());
  };

  const send = async () => {
    const body = draft.trim();
    if (!video || !body || sending) return;
    setSending(true);
    try {
      const parentId = replyTo ? (replyTo.parentId ?? replyTo.id) : null;
      const created = await api.addComment(video.id, body, parentId);
      if (parentId) {
        setReplies((all) => ({ ...all, [parentId]: [...(all[parentId] ?? []), created] }));
        setItems((list) => list.map((x) => (x.id === parentId ? { ...x, replyCount: x.replyCount + 1 } : x)));
      } else {
        setItems((list) => [created, ...list]);
      }
      const next = total + 1;
      setTotal(next);
      onTotalChange(video.id, next);
      setDraft('');
      setReplyTo(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSending(false);
    }
  };

  const openProfile = (handle: string) => {
    close();
    router.push(`/user/${handle}`);
  };

  const renderComment = (c: Comment, isReply = false) => (
    <View key={c.id} style={[styles.comment, isReply && styles.reply]}>
      <Avatar user={c.author} size={isReply ? 28 : 36} onPress={() => openProfile(c.author.handle)} />
      <View style={styles.commentBody}>
        <Text style={styles.commentHandle} onPress={() => openProfile(c.author.handle)}>
          {c.author.handle}
        </Text>
        <Text style={styles.commentText}>{c.body}</Text>
        <View style={styles.commentMeta}>
          <Text style={styles.metaText}>{timeAgo(c.createdAt)}</Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setReplyTo(c);
              inputRef.current?.focus();
            }}
          >
            <Text style={[styles.metaText, styles.replyLink]}>Ответить</Text>
          </Pressable>
        </View>
        {!isReply && c.replyCount > 0 && !replies[c.id] ? (
          <Pressable onPress={() => showReplies(c)} hitSlop={6}>
            <Text style={styles.moreReplies}>
              Посмотреть ответы ({c.replyCount})
            </Text>
          </Pressable>
        ) : null}
        {!isReply ? replies[c.id]?.map((r) => renderComment(r, true)) : null}
      </View>
      <Pressable style={styles.commentLike} onPress={() => toggleLike(c)} hitSlop={8}>
        <Ionicons name={c.likedByMe ? 'heart' : 'heart-outline'} size={18} color={c.likedByMe ? colors.like : colors.textMuted} />
        <Text style={styles.metaText}>{formatCount(c.likeCount)}</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal visible={video !== null} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Закрыть комментарии" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: drag }] }]}>
            <View {...pan.panHandlers} style={styles.header}>
              <View style={styles.grabber} />
              <Text style={styles.title}>
                {formatCount(total)} {plural(total, ['комментарий', 'комментария', 'комментариев'])}
              </Text>
              <Pressable style={styles.close} onPress={close} hitSlop={10} accessibilityLabel="Закрыть">
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {state === 'loading' ? (
              <ListSkeleton rows={5} />
            ) : state === 'error' ? (
              <ErrorState message={error} onRetry={load} />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(c) => String(c.id)}
                renderItem={({ item }) => renderComment(item)}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: space.lg }}
                ListEmptyComponent={<Text style={styles.empty}>Пока нет комментариев. Будьте первым.</Text>}
              />
            )}

            {replyTo ? (
              <View style={styles.replyBanner}>
                <Text style={styles.metaText}>Ответ @{replyTo.author.handle}</Text>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}
            <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
              {me ? <Avatar user={me} size={32} /> : null}
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Добавить комментарий…"
                placeholderTextColor={colors.textFaint}
                maxLength={500}
                multiline
                returnKeyType="send"
              />
              <Pressable
                onPress={send}
                disabled={!draft.trim() || sending}
                hitSlop={8}
                accessibilityLabel="Отправить"
              >
                {sending ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons name="arrow-up-circle" size={34} color={draft.trim() ? colors.accent : colors.textFaint} />
                )}
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  header: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space.sm },
  title: { color: colors.text, fontWeight: '600', fontSize: font.sm + 1 },
  close: { position: 'absolute', right: space.md, top: space.md },
  comment: { flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },
  reply: { paddingHorizontal: 0, paddingTop: space.md },
  commentBody: { flex: 1 },
  commentHandle: { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },
  commentText: { color: colors.text, fontSize: font.md, marginTop: 2, lineHeight: 20 },
  commentMeta: { flexDirection: 'row', gap: space.lg, marginTop: space.xs },
  metaText: { color: colors.textFaint, fontSize: font.sm - 1 },
  replyLink: { fontWeight: '600', color: colors.textMuted },
  moreReplies: { color: colors.textMuted, fontSize: font.sm - 1, fontWeight: '600', marginTop: space.sm },
  commentLike: { alignItems: 'center', width: 36 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: space.xxl },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.surfaceRaised,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: font.md,
    maxHeight: 100,
  },
});
