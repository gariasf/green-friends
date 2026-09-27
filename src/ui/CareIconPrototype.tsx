import Storage from 'expo-sqlite/kv-store';
import type { IconWeight } from 'phosphor-react-native';
import { DevSettings, DynamicColorIOS, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font } from '@/src/ui/theme';

/**
 * PROTOTYPE (prototype/care-icons, never merged): six ways to draw the care types' icons, since
 * the owner finds the filled, bright ones too playful. Read once at startup; the pill stores a
 * pick and reloads the app. The Web view takes ?care=A…F.
 */
export const CARE_VARIANTS = {
  A: 'Filled in hue (today)',
  B: 'Outline in hue',
  C: 'Duotone in hue',
  D: 'Muted hues, filled',
  E: 'One colour',
  F: 'Chip',
} as const;
type Variant = keyof typeof CARE_VARIANTS;
const KEYS = Object.keys(CARE_VARIANTS) as Variant[];
const STORE_KEY = 'prototype.careIcons';
const stored = Storage.getItemSync(STORE_KEY);
export const careVariant: Variant = stored && stored in CARE_VARIANTS ? (stored as Variant) : 'A';

const MUTED: Record<string, ReturnType<typeof DynamicColorIOS>> = {
  water: DynamicColorIOS({ light: '#4f7090', dark: '#8aa9c6' }),
  fertilize: DynamicColorIOS({ light: '#8f8338', dark: '#bdb070' }),
  repot: DynamicColorIOS({ light: '#8a4a3e', dark: '#c07b6e' }),
  note: DynamicColorIOS({ light: '#8e8e93', dark: '#8e8e93' }),
};

/** How a care type's icon draws under the chosen variant. */
export function careLook(
  name: string,
  hue: unknown,
): { weight: IconWeight; color: unknown; chip: boolean } {
  switch (careVariant) {
    case 'B':
      return { weight: 'regular', color: hue, chip: false };
    case 'C':
      return { weight: 'duotone', color: hue, chip: false };
    case 'D':
      return { weight: 'fill', color: MUTED[name] ?? hue, chip: false };
    case 'E':
      return { weight: 'regular', color: colors.secondaryLabel, chip: false };
    case 'F':
      return { weight: 'regular', color: hue, chip: true };
    default:
      return { weight: 'fill', color: hue, chip: false };
  }
}

export function CareIconSwitcher() {
  const insets = useSafeAreaInsets();
  const index = KEYS.indexOf(careVariant);
  const go = (step: number) => {
    Storage.setItemSync(STORE_KEY, KEYS[(index + step + KEYS.length) % KEYS.length]);
    DevSettings.reload();
  };
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 56 }]}>
      <View style={styles.bar}>
        <Pressable accessibilityLabel="Previous care icons" hitSlop={12} onPress={() => go(-1)}>
          <Text style={styles.label}>‹</Text>
        </Pressable>
        <Text allowFontScaling={false} style={styles.label}>
          Care {careVariant} · {CARE_VARIANTS[careVariant]}
        </Text>
        <Pressable accessibilityLabel="Next care icons" hitSlop={12} onPress={() => go(1)}>
          <Text style={styles.label}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0f766e',
  },
  label: { ...font.bold, fontSize: 13, color: '#fff' },
});
