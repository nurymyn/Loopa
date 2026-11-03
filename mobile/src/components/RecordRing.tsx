import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

const SIZE = 84;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** Record button: white ring, lime progress arc while recording, red core. */
export function RecordRing({ progress, recording }: { progress: number; recording: boolean }) {
  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.85)" strokeWidth={STROKE} fill="none" />
        {recording ? (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.accent}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={C * (1 - Math.min(1, progress))}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        ) : null}
      </Svg>
      <View style={[styles.core, recording && styles.coreRecording]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  core: { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: colors.like },
  coreRecording: { width: 30, height: 30, borderRadius: 7 },
});
