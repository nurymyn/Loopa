import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCount } from '../lib/format';
import type { Video } from '../lib/types';
import { colors, font } from '../theme';

/** Three-column grid of previews with view counts. Rendered inside a parent ScrollView. */
export function VideoGrid({ videos, onOpen }: { videos: Video[]; onOpen: (index: number) => void }) {
  return (
    <View style={styles.grid}>
      {videos.map((v, i) => (
        <Pressable key={v.id} style={styles.cell} onPress={() => onOpen(i)} accessibilityLabel={`Видео ${v.caption}`}>
          <View style={styles.inner}>
            {v.thumbnailUrl ? (
              <Image source={{ uri: v.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.noThumb]}>
                <Ionicons name="film-outline" size={24} color={colors.textFaint} />
              </View>
            )}
            <View style={styles.views}>
              <Ionicons name="play-outline" size={13} color={colors.text} />
              <Text style={styles.viewsText}>{formatCount(v.viewCount)}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.333%', aspectRatio: 3 / 4, padding: 1 },
  inner: { flex: 1, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  views: { position: 'absolute', left: 6, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewsText: { color: colors.text, fontSize: font.xs + 1, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3 },
});
