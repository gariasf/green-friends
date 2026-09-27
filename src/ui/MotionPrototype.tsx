import * as Haptics from 'expo-haptics';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, type ReactNode } from 'react';
import { DevSettings, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * PROTOTYPE (prototype/motion, #55 step 4, never merged): one switch, read once at startup; a tap
 * on the pill moves it on and reloads. Phone only.
 *
 * - A today's: the tick swaps in, every tick fires the Success haptic, rows fade out in 150 ms,
 *   the hero's bar flips opaque, a Garden cell dims on press, sheets and the toast as they are.
 *   Reanimated's default ReduceMotion.System skips its animations under Reduce Motion.
 * - B subtle (150–200 ms, timing): the check fades and grows into the circle with a light haptic,
 *   rows and cards fade and the rest ease up; the hero drifts at half speed and its bar fades in;
 *   a Garden cell sinks a little on press and the photo fades in on the Plant screen; sheet
 *   content fades in; the toast rises a short way.
 * - C springy: the check pops in on a spring with a light haptic, the rest springs into place; the
 *   hero drifts and stretches when pulled down; a Garden cell sinks on a spring and the photo
 *   settles from a slight zoom; a sheet's parts rise in one after another; the toast springs up.
 *
 * Success stays for Log all and the log sheet's Save in B and C. Under Reduce Motion, B and C
 * cross-fade (ReduceMotion.Never on fades only) and keep the haptics; nothing moves or scales.
 *
 * Imports nothing from theme.ts.
 */
const KEY = 'prototype.motion';
const VALUES = ['A', 'B', 'C'] as const;
type Variant = (typeof VALUES)[number];
const NAMES: Record<Variant, string> = { A: 'today', B: 'subtle', C: 'springy' };

function read(): Variant {
  const stored = Storage.getItemSync(KEY);
  return (VALUES as readonly string[]).includes(stored ?? '') ? (stored as Variant) : 'A';
}

export const motion: Variant = read();

/** Screenshots set this to leave the pill out. */
const hidden = Storage.getItemSync('prototype.hidePill') === '1';

const EASE = Easing.out(Easing.cubic);
const SPRING = { damping: 14, stiffness: 220, mass: 0.8 };

/** A cross-fade that plays under Reduce Motion too, since it moves nothing. */
const fadeIn = (ms: number) => FadeIn.duration(ms).reduceMotion(ReduceMotion.Never);
const fadeOut = (ms: number) => FadeOut.duration(ms).reduceMotion(ReduceMotion.Never);

/** Today's layout animations: how a card or row comes, goes, and how the rest move. */
export function useTodayMotion() {
  const reduced = useReducedMotion();
  if (motion === 'A') {
    return { layout: LinearTransition, entering: FadeIn, exiting: FadeOut.duration(150) };
  }
  if (reduced) return { layout: undefined, entering: fadeIn(200), exiting: fadeOut(180) };
  if (motion === 'B') {
    return {
      layout: LinearTransition.duration(200).easing(EASE),
      entering: FadeIn.duration(180),
      exiting: FadeOut.duration(150),
    };
  }
  return {
    layout: LinearTransition.springify().damping(16).stiffness(180),
    entering: FadeIn.duration(220),
    exiting: FadeOut.duration(140),
  };
}

/** How long a ticked circle shows its tick before the care is logged and its row leaves. */
export const TICK_MS = motion === 'C' ? 380 : motion === 'B' ? 300 : 250;

/** The haptic for one tick: Success in A, a light impact in B and C (HIG: Success is for a task). */
export function tickHaptic() {
  if (motion === 'A') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** For Log all and the log sheet's Save: Success in every variant. */
export function taskHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Today's check circle: in A the icon swaps; in B and C the check grows (timing or spring) and
 * fades over the empty circle, which fades away under it. Reduce Motion keeps the fade only.
 */
export function TickMark({
  done,
  circle,
  check,
  size,
}: {
  done: boolean;
  circle: ReactNode;
  check: ReactNode;
  size: number;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    if (motion === 'A') return;
    progress.value =
      motion === 'C' && !reduced && done
        ? withSpring(1, SPRING)
        : withTiming(done ? 1 : 0, { duration: done ? 180 : 120, easing: EASE });
  }, [done, reduced, progress]);
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.5),
    transform: [{ scale: reduced ? 1 : 0.4 + 0.6 * progress.value }],
  }));
  const circleStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  if (motion === 'A') return <>{done ? check : circle}</>;
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, circleStyle]}>{circle}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, checkStyle]}>{check}</Animated.View>
    </View>
  );
}

/**
 * A Garden cell that sinks as it's pressed: dims in A (today's pressedStyle), scales to 0.97 on a
 * timing in B, to 0.95 on a spring in C. Reduce Motion dims instead.
 */
export function PressScale({
  onPress,
  style,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  style: ViewStyle;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const scaled = motion !== 'A' && !reduced;
  const animated = useAnimatedStyle(() => ({
    opacity: scaled ? 1 : 1 - 0.5 * pressed.value,
    transform: [{ scale: scaled ? 1 - (motion === 'C' ? 0.05 : 0.03) * pressed.value : 1 }],
  }));
  const to = (value: number) => {
    if (motion === 'A') pressed.value = value;
    else if (motion === 'C' && !reduced) pressed.value = withSpring(value, SPRING);
    else pressed.value = withTiming(value, { duration: 120, easing: EASE });
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/** How the Plant screen's hero photo arrives: at once in A, a fade in B, a settling zoom in C. */
export function useHeroEntering() {
  const reduced = useReducedMotion();
  if (motion === 'A') return undefined;
  if (motion === 'B' || reduced) return fadeIn(motion === 'B' ? 200 : 240);
  return settle;
}

/** C's photo: fades in as it settles from a slight zoom on a spring. */
function settle() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 1.06 }] },
    animations: {
      opacity: withTiming(1, { duration: 240 }),
      transform: [{ scale: withSpring(1, SPRING) }],
    },
  };
}

/** In C, the hero stretches from its foot when pulled down. Nothing under Reduce Motion. */
export function heroStretch(y: number, height: number, reduced: boolean) {
  'worklet';
  if (motion !== 'C' || reduced || y >= 0) return { transform: [{ translateY: 0 }, { scale: 1 }] };
  return { transform: [{ translateY: y / 2 }, { scale: 1 - y / height }] };
}

/** In B and C, the photo drifts at half speed as it scrolls up. Nothing under Reduce Motion. */
export function heroDrift(y: number, reduced: boolean) {
  'worklet';
  if (motion === 'A' || reduced) return { transform: [{ translateY: 0 }] };
  return { transform: [{ translateY: Math.max(0, y) / 2 }] };
}

/** A sheet's parts: at once in A, a fade in B, one after another rising in C. */
export function useSheetEntering() {
  const reduced = useReducedMotion();
  return (index: number) => {
    if (motion === 'A') return undefined;
    if (motion === 'B' || reduced) return fadeIn(180).delay(motion === 'B' ? 60 : 0);
    return FadeInDown.springify()
      .damping(18)
      .stiffness(200)
      .delay(80 + index * 45);
  };
}

/** The undo toast's way in and out. */
export function useToastMotion() {
  const reduced = useReducedMotion();
  if (motion === 'A') return { entering: FadeInDown, exiting: FadeOutDown };
  if (reduced) return { entering: fadeIn(200), exiting: fadeOut(160) };
  if (motion === 'B') {
    return {
      entering: FadeInDown.duration(200)
        .easing(EASE)
        .withInitialValues({
          opacity: 0,
          transform: [{ translateY: 12 }],
        }),
      exiting: FadeOutDown.duration(150),
    };
  }
  return {
    entering: FadeInDown.springify().damping(13).stiffness(190),
    exiting: FadeOutDown.duration(160),
  };
}

export function MotionSwitcher() {
  const insets = useSafeAreaInsets();
  if (hidden) return null;
  const next = () => {
    Storage.setItemSync(KEY, VALUES[(VALUES.indexOf(motion) + 1) % VALUES.length]);
    DevSettings.reload();
  };
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 56 }]}>
      <Pressable accessibilityLabel="Next motion variant" hitSlop={8} onPress={next}>
        <View style={styles.bar}>
          <Text allowFontScaling={false} style={styles.label}>
            Motion {motion} · {NAMES[motion]}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0f766e',
  },
  label: { fontFamily: 'Nunito Sans', fontWeight: '700', fontSize: 13, color: '#fff' },
});
