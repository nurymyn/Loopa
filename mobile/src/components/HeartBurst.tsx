import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors } from '../theme';

const SIZE = 110;

/** Big red heart that pops at the tap point, floats up a little and fades. */
export function HeartBurst({ x, y, tilt, onDone }: { x: number; y: number; tilt: number; onDone: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.15, friction: 4, tension: 160, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 450, delay: 150, useNativeDriver: true }),
        Animated.timing(lift, { toValue: -60, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.4, duration: 600, useNativeDriver: true }),
      ]),
    ]).start(onDone);
  }, [scale, opacity, lift, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.heart,
        {
          left: x - SIZE / 2,
          top: y - SIZE / 2,
          opacity,
          transform: [{ translateY: lift }, { scale }, { rotate: `${tilt}deg` }],
        },
      ]}
    >
      <Ionicons name="heart" size={SIZE} color={colors.like} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heart: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
