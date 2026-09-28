import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { DynamicColorIOS, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * PROTOTYPE (prototype/phone-polish, #81, never merged): three switches, read at startup; a tap on
 * a pill's part moves that switch on and remounts every screen (DevSettings.reload does nothing in
 * Release), so whatever reads `polish` reads it at render. Phone only.
 *
 * - today: A today's; B one hero (only the first card, the most Overdue, raised; the rest outlined
 *   on the surface) and a plant with one Due care type folded into one row, ⋯ a bare glyph.
 * - tiles: A today's; B the values say which way they count ("in 3 d", "5 d overdue", units small),
 *   the second line the next date while upcoming, and Done out of the tiles into a tinted row
 *   under them; C B's values, and a Due tile's tap logs it today (with Undo), a long-press opens
 *   the log sheet.
 * - finish: A today's; B serif section headings (the web's h2), warm sheets and pushed bars, the
 *   Care Guide's cards outlined, quieter placeholders, white bar buttons over the photo, the Care
 *   card's other icons at bold weight, and the log sheet's date picker behind "Earlier…".
 */
const SWITCHES = {
  today: { key: 'prototype.today', values: ['A', 'B'], label: 'Today' },
  tiles: { key: 'prototype.tiles', values: ['A', 'B', 'C'], label: 'Tiles' },
  finish: { key: 'prototype.finish', values: ['A', 'B'], label: 'Finish' },
} as const;
type Switch = keyof typeof SWITCHES;

const NAMES: Record<Switch, Record<string, string>> = {
  today: { A: 'now', B: 'hero' },
  tiles: { A: 'now', B: 'row', C: 'tap' },
  finish: { A: 'now', B: 'warm' },
};

function read(name: Switch): string {
  const { key, values } = SWITCHES[name];
  const stored = Storage.getItemSync(key);
  return stored && (values as readonly string[]).includes(stored) ? stored : 'A';
}

export const polish = {
  today: read('today') as 'A' | 'B',
  tiles: read('tiles') as 'A' | 'B' | 'C',
  finish: read('finish') as 'A' | 'B',
};

// A tap on the pill bumps this, and the root layout keys its navigator on it.
let generation = 0;
const listeners = new Set<() => void>();
export function usePolishGeneration() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => generation,
  );
}

/** Moves a switch on, keeps it, and remounts the screens. */
function next(name: Switch) {
  const { key, values } = SWITCHES[name];
  const index = (values as readonly string[]).indexOf(polish[name]);
  const value = values[(index + 1) % values.length];
  Storage.setItemSync(key, value);
  (polish as Record<Switch, string>)[name] = value;
  generation++;
  listeners.forEach((listener) => listener());
}

/** Screenshots set this to leave the pill out. */
const hidden = Storage.getItemSync('prototype.hidePill') === '1';

export function PolishSwitcher() {
  const insets = useSafeAreaInsets();
  usePolishGeneration();
  if (hidden) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 64 }]}>
      <View style={styles.bar}>
        {(Object.keys(SWITCHES) as Switch[]).map((name) => (
          <Pressable
            key={name}
            accessibilityLabel={`Next ${SWITCHES[name].label.toLowerCase()} variant`}
            hitSlop={8}
            onPress={() => next(name)}
          >
            <Text allowFontScaling={false} style={styles.label}>
              {SWITCHES[name].label} {polish[name]} · {NAMES[name][polish[name]]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Finish B's placeholder: a paler Ecru, so photos lead the grid. */
export const quietPlaceholder = DynamicColorIOS({ light: '#e6dfcd', dark: '#2a261d' });

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
