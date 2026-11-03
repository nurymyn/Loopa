import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, describeError } from '../lib/api';
import type { Counters, Video } from '../lib/types';
import { colors, font, radius, space } from '../theme';

interface Props {
  video: Video | null;
  isMine: boolean;
  onClose: () => void;
  onUpdate: (id: number, patch: Partial<Video>) => void;
}

/**
 * "Репост" sheet: repost to your profile, open the system share sheet with a
 * link to the video's web page, or copy that link.
 */
export function ShareSheet({ video, isMine, onClose, onUpdate }: Props) {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => setNote(null), [video?.id]);

  if (!video) return null;

  const counts = (c: Counters) => ({ shareCount: c.shareCount });

  const toggleRepost = async () => {
    const on = !video.repostedByMe;
    try {
      const r = await api.repost(video.id, on);
      onUpdate(video.id, { repostedByMe: r.reposted, ...counts(r) });
      setNote(on ? 'Видео появилось в ваших репостах' : 'Репост убран');
      setTimeout(onClose, 900);
    } catch (err) {
      setNote(describeError(err));
    }
  };

  const link = async () => {
    const r = await api.share(video.id);
    onUpdate(video.id, counts(r));
    return r.url;
  };

  const shareNative = async () => {
    try {
      const url = await link();
      onClose();
      await Share.share({ message: `@${video.author.handle} в Loopa: ${url}`, url });
    } catch (err) {
      setNote(describeError(err));
    }
  };

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(await link());
      setNote('Ссылка скопирована');
      setTimeout(onClose, 800);
    } catch (err) {
      setNote(describeError(err));
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Поделиться</Text>
        <View style={styles.row}>
          {!isMine ? (
            <Option
              icon={video.repostedByMe ? 'repeat' : 'repeat-outline'}
              label={video.repostedByMe ? 'Убрать репост' : 'Репост'}
              active={video.repostedByMe}
              onPress={toggleRepost}
            />
          ) : null}
          <Option icon="share-outline" label="Поделиться…" onPress={shareNative} />
          <Option icon="link-outline" label="Скопировать ссылку" onPress={copy} />
        </View>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </Modal>
  );
}

function Option({
  icon,
  label,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable style={styles.option} onPress={onPress} accessibilityRole="button">
      <View style={[styles.circle, active && { backgroundColor: colors.accent }]}>
        <Ionicons name={icon} size={24} color={active ? colors.onAccent : colors.text} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
  title: { color: colors.text, fontWeight: '600', fontSize: font.sm + 1, textAlign: 'center', marginVertical: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: space.md },
  option: { alignItems: 'center', width: 96, gap: space.sm },
  circle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, fontSize: font.sm - 1, textAlign: 'center' },
  note: { color: colors.accent, textAlign: 'center', fontSize: font.sm, marginTop: space.sm },
});
