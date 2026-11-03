import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../theme';

/** Grey block that gently pulses while content loads. */
export function Skeleton({
  width = '100%',
  height = 14,
  round,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  round?: boolean;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        { width, height, opacity, backgroundColor: colors.surfaceRaised, borderRadius: round ? 999 : radius.sm },
        style,
      ]}
    />
  );
}

export function FeedSkeleton() {
  return (
    <View style={styles.feed}>
      <View style={styles.feedRail}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={40} height={40} round style={{ marginBottom: space.lg }} />
        ))}
      </View>
      <View style={styles.feedText}>
        <Skeleton width={120} height={16} />
        <Skeleton width="80%" style={{ marginTop: space.sm }} />
        <Skeleton width="55%" style={{ marginTop: space.sm }} />
      </View>
    </View>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={{ padding: space.lg }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={44} height={44} round />
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Skeleton width="45%" />
            <Skeleton width="75%" style={{ marginTop: space.sm }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function GridSkeleton({ cells = 9 }: { cells?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: cells }, (_, i) => (
        <View key={i} style={styles.cell}>
          <Skeleton height="100%" style={{ borderRadius: 0 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { flex: 1, backgroundColor: colors.bg, justifyContent: 'flex-end' },
  feedRail: { position: 'absolute', right: space.md, bottom: 120, alignItems: 'center' },
  feedText: { padding: space.lg, paddingBottom: space.xl, width: '75%' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.333%', aspectRatio: 9 / 16, padding: 1 },
});
