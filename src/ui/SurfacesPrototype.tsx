import Storage from 'expo-sqlite/kv-store';
import { DevSettings, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * PROTOTYPE (prototype/surfaces, #55 step 2, never merged): three switches, each read once at
 * startup; a tap on the pill's part moves that switch on and reloads. The Web view takes
 * ?ground=A|B|C&hero=A|B|C&garden=A|B.
 *
 * - ground: A today's grey and grouped, B a warm ground from Ecru with flat boxes, C the warm
 *   ground with Today's cards and the tiles raised (a two-part shadow in light mode, a lighter
 *   surface in dark mode). B and C also take three radii and a warm secondary label.
 * - hero: A today's band, B the photo at the top edge with the name below it, C the name over the
 *   photo on a scrim. In B and C a plant without a photo gets a compact header instead.
 * - garden: A the list, B a photo grid.
 *
 * Imports nothing from theme.ts, which reads it.
 */
const SWITCHES = {
  ground: { key: 'prototype.ground', values: ['A', 'B', 'C'], label: 'Ground' },
  hero: { key: 'prototype.hero', values: ['A', 'B', 'C'], label: 'Hero' },
  garden: { key: 'prototype.garden', values: ['A', 'B'], label: 'Garden' },
} as const;
type Switch = keyof typeof SWITCHES;

function read(name: Switch): string {
  const { key, values } = SWITCHES[name];
  const stored = Storage.getItemSync(key);
  return stored && (values as readonly string[]).includes(stored) ? stored : 'A';
}

export const surfaces = {
  ground: read('ground') as 'A' | 'B' | 'C',
  hero: read('hero') as 'A' | 'B' | 'C',
  garden: read('garden') as 'A' | 'B',
};

const NAMES: Record<Switch, Record<string, string>> = {
  ground: { A: 'grey', B: 'warm', C: 'raised' },
  hero: { A: 'today', B: 'below', C: 'scrim' },
  garden: { A: 'list', B: 'grid' },
};

/** Screenshots set this to leave the pill out. */
const hidden = Storage.getItemSync('prototype.hidePill') === '1';

export function SurfacesSwitcher() {
  const insets = useSafeAreaInsets();
  if (hidden) return null;
  const next = (name: Switch) => {
    const { key, values } = SWITCHES[name];
    const index = (values as readonly string[]).indexOf(surfaces[name]);
    Storage.setItemSync(key, values[(index + 1) % values.length]);
    DevSettings.reload();
  };
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 56 }]}>
      <View style={styles.bar}>
        {(Object.keys(SWITCHES) as Switch[]).map((name) => (
          <Pressable
            key={name}
            accessibilityLabel={`Next ${SWITCHES[name].label.toLowerCase()} variant`}
            hitSlop={8}
            onPress={() => next(name)}
          >
            <Text allowFontScaling={false} style={styles.label}>
              {SWITCHES[name].label} {surfaces[name]} · {NAMES[name][surfaces[name]]}
            </Text>
          </Pressable>
        ))}
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
  label: { fontFamily: 'Nunito Sans', fontWeight: '700', fontSize: 13, color: '#fff' },
});
