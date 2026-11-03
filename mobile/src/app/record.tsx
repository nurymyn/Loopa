import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecordRing } from '../components/RecordRing';
import { MAX_VIDEO_SECONDS, pickVideoFromLibrary } from '../lib/pickVideo';
import { colors, font, radius, space } from '../theme';

const COUNTDOWN = 3;

/**
 * "+" opens this screen: a real camera (expo-camera, works in Expo Go).
 * Tap the button to start, tap again to stop; recording stops by itself at 60 s.
 * Flip camera, torch and a 3-second timer. Gallery is the alternative.
 * The result goes to /publish for preview, caption and upload.
 */
export default function RecordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const camera = useRef<ComponentRef<typeof CameraView>>(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [timerOn, setTimerOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) requestCam();
    if (micPerm && !micPerm.granted && micPerm.canAskAgain) requestMic();
  }, [camPerm, micPerm, requestCam, requestMic]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 100);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      startRecording();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const toPublish = (uri: string) => router.replace({ pathname: '/publish', params: { uri } });

  const startRecording = async () => {
    if (!camera.current || recording) return;
    setRecording(true);
    setElapsed(0);
    startedAt.current = Date.now();
    try {
      const result = await camera.current.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      setRecording(false);
      if (result?.uri) toPublish(result.uri);
    } catch {
      setRecording(false);
    }
  };

  const onRecordPress = () => {
    if (recording) {
      camera.current?.stopRecording();
      return;
    }
    if (countdown !== null) {
      setCountdown(null);
      return;
    }
    if (timerOn) setCountdown(COUNTDOWN);
    else startRecording();
  };

  const fromGallery = async () => {
    const uri = await pickVideoFromLibrary();
    if (uri) toPublish(uri);
  };

  if (!camPerm || !micPerm) return <View style={styles.screen} />;

  if (!camPerm.granted || !micPerm.granted) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="videocam-off-outline" size={44} color={colors.textMuted} />
        <Text style={styles.permText}>Чтобы снимать видео, Loopa нужен доступ к камере и микрофону.</Text>
        <Pressable
          style={styles.permButton}
          onPress={async () => {
            await requestCam();
            await requestMic();
          }}
        >
          <Text style={styles.permButtonText}>Разрешить</Text>
        </Pressable>
        <Pressable onPress={fromGallery} style={{ marginTop: space.lg }}>
          <Text style={styles.link}>Выбрать из галереи</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: space.lg }}>
          <Text style={styles.link}>Закрыть</Text>
        </Pressable>
      </View>
    );
  }

  const remaining = Math.max(0, Math.ceil(MAX_VIDEO_SECONDS - elapsed));

  return (
    <View style={styles.screen}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        mode="video"
        facing={facing}
        enableTorch={torch}
        onCameraReady={() => setReady(true)}
      />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={recording} accessibilityLabel="Закрыть">
          <Ionicons name="close" size={30} color={colors.text} />
        </Pressable>
        {recording ? (
          <View style={styles.timePill}>
            <View style={styles.dot} />
            <Text style={styles.timeText}>
              0:{String(Math.floor(elapsed)).padStart(2, '0')} · осталось {remaining} с
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.side, { top: insets.top + 64 }]}>
        <SideButton
          icon="camera-reverse-outline"
          label="Камера"
          disabled={recording}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        />
        <SideButton icon={torch ? 'flash' : 'flash-outline'} label="Вспышка" active={torch} onPress={() => setTorch((t) => !t)} />
        <SideButton icon="timer-outline" label={`${COUNTDOWN} с`} active={timerOn} disabled={recording} onPress={() => setTimerOn((t) => !t)} />
      </View>

      {countdown !== null && countdown > 0 ? (
        <View style={styles.countdown} pointerEvents="none">
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.xl }]}>
        <Pressable style={styles.gallery} onPress={fromGallery} disabled={recording} accessibilityLabel="Галерея">
          <Ionicons name="images-outline" size={26} color={colors.text} />
          <Text style={styles.sideLabel}>Галерея</Text>
        </Pressable>
        <Pressable onPress={onRecordPress} disabled={!ready} accessibilityLabel={recording ? 'Остановить запись' : 'Начать запись'}>
          <RecordRing progress={elapsed / MAX_VIDEO_SECONDS} recording={recording} />
        </Pressable>
        <View style={styles.gallery} />
      </View>
    </View>
  );
}

function SideButton({
  icon,
  label,
  onPress,
  active,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.sideButton, disabled && { opacity: 0.4 }]} hitSlop={6}>
      <Ionicons name={icon} size={26} color={active ? colors.accent : colors.text} />
      <Text style={[styles.sideLabel, active && { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md },
  permText: { color: colors.textMuted, fontSize: font.md, textAlign: 'center', lineHeight: 21 },
  permButton: { backgroundColor: colors.accent, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.md },
  permButtonText: { color: colors.onAccent, fontWeight: '700', fontSize: font.md },
  link: { color: colors.textMuted, textDecorationLine: 'underline' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.lg },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.like },
  timeText: { color: colors.text, fontWeight: '600', fontSize: font.sm },
  side: { position: 'absolute', right: space.md, gap: space.lg, alignItems: 'center' },
  sideButton: { alignItems: 'center', gap: 2 },
  sideLabel: { color: colors.text, fontSize: font.xs, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  countdown: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  countdownText: { color: colors.text, fontSize: 120, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  gallery: { width: 64, alignItems: 'center', gap: 2 },
});
