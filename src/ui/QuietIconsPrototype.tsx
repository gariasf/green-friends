import Storage from 'expo-sqlite/kv-store';
import { DevSettings, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font } from '@/src/ui/theme';

/**
 * PROTOTYPE (prototype/quiet-icons, never merged): the icons outside the care types that draw
 * filled or bold, compared with plainer ones or none. Read once at startup; the pill stores a
 * pick and reloads. The Web view takes ?quiet=A…D.
 */
export const QUIET_VARIANTS = {
  A: 'Filled and bold (today)',
  B: 'All Regular',
  C: 'Regular, leaf and paw removed',
  D: 'Regular, initial for the leaf, no paw',
} as const;
type Variant = keyof typeof QUIET_VARIANTS;
const KEYS = Object.keys(QUIET_VARIANTS) as Variant[];
const STORE_KEY = 'prototype.quietIcons';
const stored = Storage.getItemSync(STORE_KEY);
export const quietVariant: Variant = stored && stored in QUIET_VARIANTS ? (stored as Variant) : 'A';
/** Every icon but the care types' draws Regular. */
export const allRegular = quietVariant !== 'A';
/** The paw leaves the toxicity badge and the pet warning, whose words say it. */
export const noPaw = quietVariant === 'C' || quietVariant === 'D';

export function QuietIconsSwitcher() {
  const insets = useSafeAreaInsets();
  const index = KEYS.indexOf(quietVariant);
  const go = (step: number) => {
    Storage.setItemSync(STORE_KEY, KEYS[(index + step + KEYS.length) % KEYS.length]);
    DevSettings.reload();
  };
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 56 }]}>
      <View style={styles.bar}>
        <Pressable accessibilityLabel="Previous icon style" hitSlop={12} onPress={() => go(-1)}>
          <Text style={styles.label}>‹</Text>
        </Pressable>
        <Text allowFontScaling={false} style={styles.label}>
          Icons {quietVariant} · {QUIET_VARIANTS[quietVariant]}
        </Text>
        <Pressable accessibilityLabel="Next icon style" hitSlop={12} onPress={() => go(1)}>
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
