import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '../components/ErrorState';
import { PersonRow } from '../components/PersonRow';
import { VideoGrid } from '../components/VideoGrid';
import { api, describeError } from '../lib/api';
import { KEYS, storage } from '../lib/storage';
import type { HashtagHit, Person, Video } from '../lib/types';
import { colors, font, radius, space } from '../theme';

const MAX_RECENT = 8;

/** Search people, videos and hashtags as you type. Remembers recent searches on the device. */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ users: Person[]; videos: Video[]; hashtags: HashtagHit[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    storage
      .get(KEYS.recentSearches)
      .then((raw) => setRecent(raw ? (JSON.parse(raw) as string[]) : []))
      .catch(() => {});
  }, []);

  const saveRecent = (list: string[]) => {
    setRecent(list);
    storage.set(KEYS.recentSearches, JSON.stringify(list)).catch(() => {});
  };

  const remember = () => {
    const q = text.trim();
    if (!q) return;
    saveRecent([q, ...recent.filter((r) => r !== q)].slice(0, MAX_RECENT));
  };

  // Search as you type, with a short pause so we don't hit the API on every key.
  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setResult(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          setResult(r);
          setError(null);
        })
        .catch((err) => setError(describeError(err)));
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  const toggle = (p: Person) => {
    const on = !p.isFollowing;
    setResult((r) => (r ? { ...r, users: r.users.map((u) => (u.id === p.id ? { ...u, isFollowing: on } : u)) } : r));
    api.follow(p.handle, on).catch(() => {});
  };

  const go = (fn: () => void) => {
    remember();
    fn();
  };

  const empty = result && result.users.length === 0 && result.videos.length === 0 && result.hashtags.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Назад">
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            onSubmitEditing={remember}
            placeholder="Люди, видео, #хэштеги"
            placeholderTextColor={colors.textFaint}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
          />
          {text ? (
            <Pressable onPress={() => setText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? (
        <ErrorState message={error} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}>
          {!result && recent.length > 0 ? (
            <>
              <View style={styles.recentHead}>
                <Text style={styles.section}>Недавние</Text>
                <Pressable onPress={() => saveRecent([])} hitSlop={8}>
                  <Text style={styles.clear}>Очистить</Text>
                </Pressable>
              </View>
              {recent.map((r) => (
                <Pressable key={r} style={styles.recentRow} onPress={() => setText(r)}>
                  <Ionicons name="time-outline" size={18} color={colors.textFaint} />
                  <Text style={styles.recentText}>{r}</Text>
                  <Pressable onPress={() => saveRecent(recent.filter((x) => x !== r))} hitSlop={8}>
                    <Ionicons name="close" size={18} color={colors.textFaint} />
                  </Pressable>
                </Pressable>
              ))}
            </>
          ) : null}

          {result && result.hashtags.length > 0 ? <Text style={styles.section}>Хэштеги</Text> : null}
          {result?.hashtags.map((h) => (
            <Pressable
              key={h.tag}
              style={styles.recentRow}
              onPress={() => go(() => router.push({ pathname: '/hashtag/[tag]', params: { tag: h.tag } }))}
            >
              <View style={styles.hashBadge}>
                <Text style={styles.hash}>#</Text>
              </View>
              <Text style={styles.recentText}>#{h.tag}</Text>
              <Text style={styles.clear}>{h.videos} видео</Text>
            </Pressable>
          ))}

          {result && result.users.length > 0 ? <Text style={styles.section}>Аккаунты</Text> : null}
          {result?.users.map((p) => (
            <PersonRow key={p.id} person={p} onOpen={() => go(() => router.push(`/user/${p.handle}`))} onToggleFollow={() => toggle(p)} />
          ))}

          {result && result.videos.length > 0 ? <Text style={styles.section}>Видео</Text> : null}
          {result ? (
            <VideoGrid
              videos={result.videos}
              onOpen={(i) => go(() => router.push({ pathname: '/video/[id]', params: { id: String(result.videos[i].id) } }))}
            />
          ) : null}
          {empty ? <Text style={styles.empty}>Ничего не нашлось</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, color: colors.text, fontSize: font.md, paddingVertical: space.sm + 2 },
  section: { color: colors.textMuted, fontWeight: '600', fontSize: font.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: space.lg },
  clear: { color: colors.textFaint, fontSize: font.sm },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
  recentText: { flex: 1, color: colors.text, fontSize: font.md },
  hashBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  hash: { color: colors.accent, fontWeight: '800', fontSize: font.lg },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: space.xxl },
});
