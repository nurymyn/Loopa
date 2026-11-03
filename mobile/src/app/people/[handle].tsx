import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { EmptyState, ErrorState } from '../../components/ErrorState';
import { PersonRow } from '../../components/PersonRow';
import { ListSkeleton } from '../../components/Skeleton';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import type { Person } from '../../lib/types';
import { usePaged } from '../../lib/usePaged';
import { colors, font, space } from '../../theme';

type Kind = 'followers' | 'following';

/** Followers / following of a user, with follow buttons and infinite scroll. */
export default function PeopleScreen() {
  const params = useLocalSearchParams<{ handle: string; kind?: Kind }>();
  const handle = String(params.handle);
  const router = useRouter();
  const { me } = useSession();
  const [kind, setKind] = useState<Kind>(params.kind === 'following' ? 'following' : 'followers');
  const list = usePaged<Person>(useCallback((c: string | null) => api.userPeople(handle, kind, c), [handle, kind]));

  useEffect(() => {
    list.setItems(null);
    list.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const toggle = (p: Person) => {
    const on = !p.isFollowing;
    list.setItems((items) => items?.map((x) => (x.id === p.id ? { ...x, isFollowing: on } : x)) ?? null);
    api.follow(p.handle, on).catch(list.reload);
  };

  return (
    <View style={styles.screen}>
      <BackHeader title={`@${handle}`} />
      <View style={styles.tabs}>
        {(['following', 'followers'] as Kind[]).map((k) => (
          <Pressable key={k} style={[styles.tab, kind === k && styles.tabOn]} onPress={() => setKind(k)}>
            <Text style={[styles.tabText, kind === k && { color: colors.text }]}>{k === 'followers' ? 'Подписчики' : 'Подписки'}</Text>
          </Pressable>
        ))}
      </View>
      {list.error && !list.items ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.items ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) =>
            item.id === me?.id ? (
              <PersonRowSelf person={item} onOpen={() => router.push(`/user/${item.handle}`)} />
            ) : (
              <PersonRow
                person={item}
                followLabel={item.followsYou ? 'Взаимно' : 'Подписаться'}
                onOpen={() => router.push(`/user/${item.handle}`)}
                onToggleFollow={() => toggle(item)}
              />
            )
          }
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.text} />}
          ListEmptyComponent={<EmptyState icon="people-outline" text="Список пуст" />}
          ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.text} style={{ margin: space.lg }} /> : undefined}
        />
      )}
    </View>
  );
}

function PersonRowSelf({ person, onOpen }: { person: Person; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} style={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
      <Text style={{ color: colors.text, fontWeight: '600' }}>
        {person.displayName} <Text style={{ color: colors.textMuted }}>(вы)</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderBottomWidth: 2, borderColor: 'transparent' },
  tabOn: { borderColor: colors.text },
  tabText: { color: colors.textFaint, fontWeight: '600', fontSize: font.md },
});
