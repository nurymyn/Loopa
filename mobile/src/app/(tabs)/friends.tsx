import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '../../components/ErrorState';
import { PersonRow } from '../../components/PersonRow';
import { ListSkeleton } from '../../components/Skeleton';
import { api, describeError } from '../../lib/api';
import type { Person } from '../../lib/types';
import { colors, font, space } from '../../theme';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<{ following: Person[]; suggested: Person[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.friends());
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Toggle in place; the person stays in the section they were in until the next refresh,
  // so "Подписаться" visibly turns into "Вы подписаны".
  const toggle = (p: Person) => {
    const on = !p.isFollowing;
    const flip = (list: Person[]) => list.map((x) => (x.id === p.id ? { ...x, isFollowing: on } : x));
    setData((d) => (d ? { following: flip(d.following), suggested: flip(d.suggested) } : d));
    api.follow(p.handle, on).catch(load);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Друзья</Text>
      {error && !data ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <ListSkeleton />
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}>
          <Text style={styles.section}>Ваши подписки</Text>
          {data.following.length === 0 ? (
            <Text style={styles.hint}>Вы пока ни на кого не подписаны</Text>
          ) : (
            data.following.map((p) => (
              <PersonRow key={p.id} person={p} onOpen={() => router.push(`/user/${p.handle}`)} onToggleFollow={() => toggle(p)} />
            ))
          )}
          <Text style={styles.section}>Рекомендуемые аккаунты</Text>
          {data.suggested.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              followLabel={p.followsYou ? 'Взаимно' : 'Подписаться'}
              onOpen={() => router.push(`/user/${p.handle}`)}
              onToggleFollow={() => toggle(p)}
            />
          ))}
          <View style={{ height: space.xxl }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center', paddingVertical: space.md },
  section: { color: colors.textMuted, fontSize: font.sm, fontWeight: '600', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  hint: { color: colors.textFaint, paddingHorizontal: space.lg, paddingVertical: space.sm },
});
