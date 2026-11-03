import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader } from '../components/BackHeader';
import { api, describeError, getMaxUploadMb } from '../lib/api';
import { MAX_VIDEO_SECONDS, checkVideoSize, pickVideoFromLibrary, videoFile } from '../lib/pickVideo';
import { useSession } from '../lib/session';
import { colors, font, radius, space } from '../theme';

const TAG_HINTS = ['еда', 'юмор', 'природа', 'танцы', 'техника'];

interface Picked {
  uri: string;
  name: string;
  type: string;
}

/**
 * Preview + caption + publish. Opened from the camera screen (with ?uri=) or,
 * without a video, it offers the gallery and the camera.
 */
export default function PublishScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string }>();
  const insets = useSafeAreaInsets();
  const { announcePublished } = useSession();
  const [picked, setPicked] = useState<Picked | null>(params.uri ? videoFile(String(params.uri)) : null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState<number | null>(null);

  const choose = async (source: 'library' | 'camera') => {
    if (source === 'camera') {
      router.replace('/record');
      return;
    }
    try {
      const uri = await pickVideoFromLibrary();
      if (uri) setPicked(videoFile(uri));
    } catch (err) {
      Alert.alert('Не получилось открыть галерею', String(err));
    }
  };

  const addTag = (t: string) => {
    if (caption.includes(`#${t}`)) return;
    setCaption((c) => `${c.trim()} #${t}`.trim());
  };

  const publish = async () => {
    if (!picked || progress !== null) return;
    // Ask the server for its limit and refuse a too-big file before sending it:
    // a dropped mid-upload connection looks like a network error on the phone.
    const maxUploadMb = await getMaxUploadMb();
    if (!checkVideoSize(picked.uri, maxUploadMb)) return;
    setProgress(0);
    try {
      const video = await api.publish(picked, { caption: caption.trim() }, setProgress);
      setProgress(1);
      announcePublished(video);
      router.dismissTo('/');
    } catch (err) {
      setProgress(null);
      Alert.alert('Не удалось опубликовать', describeError(err));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackHeader title="Новое видео" icon="close" />
      {!picked ? (
        <View style={styles.pick}>
          <Text style={styles.lead}>Выберите видео до {MAX_VIDEO_SECONDS} секунд</Text>
          <PickButton icon="images-outline" label="Из галереи" onPress={() => choose('library')} />
          <PickButton icon="videocam-outline" label="Снять на камеру" onPress={() => choose('camera')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
          <View style={styles.previewRow}>
            <Preview uri={picked.uri} />
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.caption}
                value={caption}
                onChangeText={setCaption}
                placeholder="Опишите видео, добавьте #хэштеги"
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={300}
              />
              <Text style={styles.counter}>{caption.length}/300</Text>
            </View>
          </View>

          <Text style={styles.label}>Темы для рекомендаций</Text>
          <View style={styles.tags}>
            {TAG_HINTS.map((t) => {
              const on = caption.includes(`#${t}`);
              return (
                <Pressable key={t} onPress={() => addTag(t)} style={[styles.tag, on && styles.tagOn]}>
                  <Text style={[styles.tagText, on && { color: colors.onAccent }]}>#{t}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={() => setPicked(null)} disabled={progress !== null} style={styles.change}>
            <Text style={styles.changeText}>Выбрать другое видео</Text>
          </Pressable>

          {progress !== null ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress < 1 ? `Загрузка… ${Math.round(progress * 100)}%` : 'Готово'}</Text>
            </View>
          ) : null}

          <Pressable style={[styles.publish, progress !== null && { opacity: 0.6 }]} onPress={publish} disabled={progress !== null}>
            <Text style={styles.publishText}>Опубликовать</Text>
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function PickButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.pickButton} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={26} color={colors.accent} />
      <Text style={styles.pickText}>{label}</Text>
    </Pressable>
  );
}

function Preview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={styles.preview} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pick: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md },
  lead: { color: colors.textMuted, fontSize: font.md, textAlign: 'center', marginBottom: space.md },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surfaceRaised,
    padding: space.lg,
    borderRadius: radius.md,
  },
  pickText: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  form: { padding: space.lg, gap: space.lg },
  previewRow: { flexDirection: 'row', gap: space.md },
  preview: { width: 110, height: 196, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  caption: { color: colors.text, fontSize: font.md, minHeight: 120, textAlignVertical: 'top', lineHeight: 21 },
  counter: { color: colors.textFaint, fontSize: font.xs, alignSelf: 'flex-end' },
  label: { color: colors.textMuted, fontSize: font.sm, fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  tagOn: { backgroundColor: colors.accent },
  tagText: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  change: { alignSelf: 'flex-start' },
  changeText: { color: colors.textMuted, textDecorationLine: 'underline', fontSize: font.sm },
  progressWrap: { gap: space.sm },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.accent },
  progressText: { color: colors.textMuted, fontSize: font.sm },
  publish: { backgroundColor: colors.accent, paddingVertical: space.md + 2, borderRadius: radius.md, alignItems: 'center' },
  publishText: { color: colors.onAccent, fontWeight: '800', fontSize: font.md + 1 },
});
