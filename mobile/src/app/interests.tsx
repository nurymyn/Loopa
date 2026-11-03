import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../components/BackHeader';
import { ErrorState } from '../components/ErrorState';
import { ListSkeleton } from '../components/Skeleton';
import { api, describeError } from '../lib/api';
import type { Interests } from '../lib/types';
import { colors, font, radius, space } from '../theme';

/** Hidden screen (triple tap on the logo): what "Для вас" thinks you like. */
export default function InterestsScreen() {
  const [data, setData] = useState<Interests | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .interests()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => setError(describeError(err)));

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.screen}>
      <BackHeader title="Ваши интересы" />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <ListSkeleton rows={5} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.lead}>
            {data.totalSignals === 0
              ? 'Алгоритм пока ничего о вас не знает. Лайкайте и досматривайте видео, и здесь появятся ваши темы.'
              : 'Так алгоритм «Для вас» понял ваши вкусы. Лайк весит 3 очка, видео, досмотренное до конца, — 1 очко.'}
          </Text>
          {data.tags.map((t) => (
            <View key={t.slug} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.tag}>#{t.slug}</Text>
                <Text style={styles.pct}>{Math.round(t.share * 100)}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(2, Math.round(t.share * 100))}%` }]} />
              </View>
              <Text style={styles.meta}>
                лайков: {t.likes} · досмотров: {t.completes}
              </Text>
            </View>
          ))}
          <Text style={styles.note}>
            {Math.round(data.explorationRate * 100)}% видео в ленте подбираются случайно, чтобы показывать новое.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.lg, gap: space.lg },
  lead: { color: colors.textMuted, fontSize: font.md, lineHeight: 21 },
  row: { gap: space.xs + 2 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between' },
  tag: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  pct: { color: colors.accent, fontSize: font.md, fontWeight: '700' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent },
  meta: { color: colors.textFaint, fontSize: font.sm - 1 },
  note: { color: colors.textFaint, fontSize: font.sm, marginTop: space.md },
});
