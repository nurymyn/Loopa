import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { api } from '../lib/api';
import type { Video } from '../lib/types';
import { colors, font, space } from '../theme';
import { ActionRail } from './ActionRail';
import { Caption } from './Caption';
import { HeartBurst } from './HeartBurst';

const DOUBLE_TAP_MS = 260;

export interface VideoItemActions {
  onAuthor: (handle: string) => void;
  onFollow: (video: Video) => void;
  onLike: (video: Video, on: boolean) => void;
  onComments: (video: Video) => void;
  onSave: (video: Video) => void;
  onShare: (video: Video) => void;
  onTag: (tag: string) => void;
  onSound: (name: string) => void;
  onToggleMute: () => void;
}

interface Props extends VideoItemActions {
  video: Video;
  height: number;
  /** This is the item on screen right now. */
  visible: boolean;
  /** Visible AND its screen is focused, no sheet on top, app in foreground. */
  canPlay: boolean;
  /** Close enough to the visible item to keep a player mounted (preloads the next one). */
  nearby: boolean;
  muted: boolean;
  myId: number | null;
  topInset: number;
  bottomInset: number;
}

export function VideoItem(props: Props) {
  const { video, height, visible, canPlay, nearby, muted, myId, topInset, bottomInset } = props;
  const [paused, setPaused] = useState(false);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number; tilt: number }[]>([]);
  const lastTap = useRef<{ t: number; timer: ReturnType<typeof setTimeout> | null }>({ t: 0, timer: null });

  // Coming back to a video always starts it playing.
  useEffect(() => {
    if (!visible) setPaused(false);
  }, [visible]);

  const like = (on: boolean) => {
    if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    props.onLike(video, on);
  };

  const onPress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const now = Date.now();
    const tap = lastTap.current;
    if (now - tap.t < DOUBLE_TAP_MS && tap.timer) {
      // Double tap: big heart where the finger was; likes but never unlikes.
      clearTimeout(tap.timer);
      tap.timer = null;
      tap.t = 0;
      setHearts((h) => [...h, { id: now, x: locationX, y: locationY, tilt: Math.random() * 30 - 15 }]);
      if (!video.likedByMe) like(true);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    tap.t = now;
    tap.timer = setTimeout(() => {
      tap.timer = null;
      setPaused((p) => !p);
    }, DOUBLE_TAP_MS);
  };

  useEffect(
    () => () => {
      if (lastTap.current.timer) clearTimeout(lastTap.current.timer);
    },
    [],
  );

  return (
    <View style={[styles.item, { height }]}>
      {nearby ? (
        <Player video={video} visible={visible} playing={canPlay && !paused} muted={muted} />
      ) : video.thumbnailUrl ? (
        <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}

      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessibilityLabel="Пауза или воспроизведение" />

      {visible && paused ? (
        <View pointerEvents="none" style={styles.pauseIcon}>
          <Ionicons name="play" size={72} color="rgba(255,255,255,0.75)" />
        </View>
      ) : null}

      {hearts.map((h) => (
        <HeartBurst key={h.id} x={h.x} y={h.y} tilt={h.tilt} onDone={() => setHearts((all) => all.filter((x) => x.id !== h.id))} />
      ))}

      <Pressable
        style={[styles.mute, { top: topInset + 52 }]}
        onPress={props.onToggleMute}
        hitSlop={10}
        accessibilityLabel={muted ? 'Включить звук' : 'Выключить звук'}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color={colors.text} />
      </Pressable>

      <View style={[styles.bottom, { paddingBottom: space.lg + bottomInset }]} pointerEvents="box-none">
        <View style={styles.meta} pointerEvents="box-none">
          <Pressable onPress={() => props.onAuthor(video.author.handle)} hitSlop={6}>
            <Text style={styles.handle}>@{video.author.handle}</Text>
          </Pressable>
          <Caption text={video.caption} style={styles.caption} numberOfLines={3} onTag={props.onTag} />
          <Pressable style={styles.sound} onPress={() => props.onSound(video.soundName)} hitSlop={6}>
            <Ionicons name="musical-notes" size={14} color={colors.text} />
            <Text style={styles.soundText} numberOfLines={1}>
              {video.soundName}
            </Text>
          </Pressable>
        </View>
        <ActionRail
          video={video}
          isMine={myId === video.author.id}
          onAuthor={() => props.onAuthor(video.author.handle)}
          onFollow={() => props.onFollow(video)}
          onLike={() => like(!video.likedByMe)}
          onComments={() => props.onComments(video)}
          onSave={() => props.onSave(video)}
          onShare={() => props.onShare(video)}
        />
      </View>
    </View>
  );
}

/**
 * The actual player. Mounted only for the visible video and its neighbours,
 * so the next clip is already buffered when you swipe.
 *
 * - The thumbnail stays on top until the first frame renders (no black flash).
 * - One view is reported per visit, when the video leaves the screen, with the
 *   watched time and whether it was watched to the end at least once.
 */
function Player({ video, visible, playing, muted }: { video: Video; visible: boolean; playing: boolean; muted: boolean }) {
  const player = useVideoPlayer(video.videoUrl, (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
  });
  const [firstFrame, setFirstFrame] = useState(false);
  const [progress, setProgress] = useState(0);
  const watch = useRef({ ms: 0, last: 0, completed: false });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  // Leaving the video: report the visit and rewind for next time.
  useEffect(() => {
    if (visible) return;
    const w = watch.current;
    if (w.ms >= 1000) api.view(video.id, Math.round(w.ms), w.completed).catch(() => {});
    watch.current = { ms: 0, last: 0, completed: false };
    setProgress(0);
    try {
      player.currentTime = 0;
    } catch {
      // Player may already be released.
    }
  }, [visible, player, video.id]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const w = watch.current;
    const delta = currentTime - w.last;
    if (delta > 0 && delta < 1.5) w.ms += delta * 1000;
    // With loop=true the time jumps back to ~0 at the end: that is a full watch.
    if (delta < -1 && w.last > 0) w.completed = true;
    const duration = player.duration || video.durationMs / 1000;
    if (duration > 0) {
      if (currentTime >= duration - 0.4) w.completed = true;
      setProgress(Math.min(1, currentTime / duration));
    }
    w.last = currentTime;
  });

  return (
    <>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
        onFirstFrameRender={() => setFirstFrame(true)}
      />
      {!firstFrame && video.thumbnailUrl ? (
        <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" pointerEvents="none" />
      ) : null}
      <View style={styles.progressTrack} pointerEvents="none">
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  item: { width: '100%', backgroundColor: colors.bg, overflow: 'hidden' },
  pauseIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  mute: {
    position: 'absolute',
    right: space.md,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.md,
  },
  meta: { flex: 1, paddingRight: space.md, gap: 6 },
  handle: { color: colors.text, fontWeight: '700', fontSize: font.md + 1, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  caption: { color: colors.text, fontSize: font.sm + 1, lineHeight: 19, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  sound: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '85%' },
  soundText: { color: colors.text, fontSize: font.sm },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  progressFill: { height: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
});
