import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import Animated, {
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

/**
 * The app's motion (#55, variant C on prototype/motion): springs where something arrives or
 * settles, short fades where something leaves. Under Reduce Motion everything only cross-fades
 * (ReduceMotion.Never on the fades, which move nothing) and the haptics stay; nothing rises,
 * scales, drifts or stretches. Reanimated only: React Native's LayoutAnimation aborted the app once.
 */
const SPRING = { damping: 14, stiffness: 220, mass: 0.8 };

/** A cross-fade that plays under Reduce Motion too, since it moves nothing. */
const fadeIn = (ms: number) => FadeIn.duration(ms).reduceMotion(ReduceMotion.Never);
const fadeOut = (ms: number) => FadeOut.duration(ms).reduceMotion(ReduceMotion.Never);

/**
 * How Today's cards and rows come and go: a fade quicker than the spring that moves the rest into
 * place, so that never shows through it.
 */
export function useListMotion() {
  const reduced = useReducedMotion();
  if (reduced) return { layout: undefined, entering: fadeIn(200), exiting: fadeOut(180) };
  return {
    layout: LinearTransition.springify().damping(16).stiffness(180),
    entering: FadeIn.duration(220),
    exiting: FadeOut.duration(140),
  };
}

/** How long a ticked circle shows its tick before the care is logged and its row leaves. */
export const TICK_MS = 380;

/** One care ticked: a light impact. Apple's HIG keeps Success for the outcome of a task. */
export function tickHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** A task done (Log all, the log sheet's Save): Success. */
export function taskHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Today's check circle: the check pops in on a spring over the empty circle, which fades away
 * under it, and fades back out when undone. Under Reduce Motion, only the fade.
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
    progress.value =
      done && !reduced ? withSpring(1, SPRING) : withTiming(done ? 1 : 0, { duration: 150 });
  }, [done, reduced, progress]);
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.5),
    transform: [{ scale: reduced ? 1 : 0.4 + 0.6 * progress.value }],
  }));
  const circleStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, circleStyle]}>{circle}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, checkStyle]}>{check}</Animated.View>
    </View>
  );
}

/**
 * A button that sinks to 0.95 on a spring while pressed, for the Garden grid's cells. Under Reduce
 * Motion it dims instead, as `pressedStyle.button` does.
 */
export function PressSink({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style: ViewProps['style'];
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    opacity: reduced ? 1 - 0.5 * pressed.value : 1,
    transform: [{ scale: reduced ? 1 : 1 - 0.05 * pressed.value }],
  }));
  const to = (value: number) => {
    pressed.value = reduced ? withTiming(value, { duration: 120 }) : withSpring(value, SPRING);
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/** The Plant screen's photo: it fades in as it settles from a slight zoom; only fades under Reduce Motion. */
export function useHeroEntering() {
  return useReducedMotion() ? fadeIn(240) : settle;
}

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

/** Pulled down, the hero stretches from its foot, its top held at the screen's edge. */
export function heroStretch(y: number, height: number, reduced: boolean) {
  'worklet';
  if (reduced || y >= 0) return { transform: [{ translateY: 0 }, { scale: 1 }] };
  return { transform: [{ translateY: y / 2 }, { scale: 1 - y / height }] };
}

/** Scrolled up, the photo drifts at half speed under what covers it. */
export function heroDrift(y: number, reduced: boolean) {
  'worklet';
  return { transform: [{ translateY: reduced ? 0 : Math.max(0, y) / 2 }] };
}

/** A sheet's parts, by their order in it: they rise in one after another; only fade under Reduce Motion. */
export function useSheetEntering() {
  const reduced = useReducedMotion();
  return (index: number) =>
    reduced
      ? fadeIn(180)
      : FadeInDown.springify()
          .damping(18)
          .stiffness(200)
          .delay(80 + index * 45);
}

/** The undo toast springs up and sinks away; only fades under Reduce Motion. */
export function useToastMotion() {
  const reduced = useReducedMotion();
  if (reduced) return { entering: fadeIn(200), exiting: fadeOut(160) };
  return {
    entering: FadeInDown.springify().damping(13).stiffness(190),
    exiting: FadeOutDown.duration(160),
  };
}
