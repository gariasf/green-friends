import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore, type ReactNode } from 'react';
import { DynamicColorIOS, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/src/ui/theme';

/**
 * PROTOTYPE (prototype/forms-polish, #90, never merged): five switches over the log and Care Event
 * sheets, Edit plant and New plant, A being main's. A pill inside each of those switches in place
 * (a root-level pill would hide under a sheet or a modal); every switch is kept, so a Release
 * build keeps it too. Some parts apply the next time a screen opens (the log sheet's opening day,
 * Edit plant as a modal).
 *
 * - chips: B a selected chip ringed in the tint, a disabled primary button in faded tint; C a
 *   selected chip on a pale tint fill in ink, a disabled button outlined.
 * - save (Edit plant): B Save in the header, greyed until something changes; C Edit plant as a
 *   modal with Cancel and Save, like New plant.
 * - forms (Edit plant, New plant): B rhythm (spacing that groups, labels on the edge, short number
 *   fields with the unit after the number, no "Optional"); C cards (each section on a surface, the
 *   care types as rows of one outlined card, "every [4] days" in one field).
 * - species: B the matches in a card with the way back above them, the best 20, no match inline;
 *   "Give it its own schedule", and the reason under the field that's missing; C the same list,
 *   no match as the card a pick turns into, and no switch: without a Species the schedule shows.
 * - words: B an all-year garden's own schedule without its Dormant field (a new one copies the
 *   Growing interval), "Last watered…", the sheets' plant name raised, Log earlier… opens on
 *   Yesterday; C the Dormant interval folded into one line in every garden, full questions, the
 *   plant's name as the sheets' title, "Log care…".
 */
const SWITCHES = {
  chips: { key: 'prototype.chips', label: 'Chips' },
  save: { key: 'prototype.save', label: 'Save' },
  forms: { key: 'prototype.forms', label: 'Forms' },
  species: { key: 'prototype.species', label: 'Species' },
  words: { key: 'prototype.words', label: 'Words' },
} as const;
type Switch = keyof typeof SWITCHES;
type Variant = 'A' | 'B' | 'C';
const VARIANTS: Variant[] = ['A', 'B', 'C'];

function read(name: Switch): Variant {
  const stored = Storage.getItemSync(SWITCHES[name].key);
  return VARIANTS.includes(stored as Variant) ? (stored as Variant) : 'A';
}

let state: Record<Switch, Variant> = {
  chips: read('chips'),
  save: read('save'),
  forms: read('forms'),
  species: read('species'),
  words: read('words'),
};
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The variants now; whatever reads them draws again on a switch. */
export function useProto(): Record<Switch, Variant> {
  return useSyncExternalStore(subscribe, () => state);
}

/** The variants for code that runs outside a render (a screen's opening state). */
export function proto(): Record<Switch, Variant> {
  return state;
}

/** Sets switches, as the pill and the screenshot script do. */
export function setProto(next: Partial<Record<Switch, Variant>>) {
  for (const [name, value] of Object.entries(next) as [Switch, Variant][]) {
    Storage.setItemSync(SWITCHES[name].key, value);
  }
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

/** Screenshots set this to leave the pill out. */
const hidden = Storage.getItemSync('prototype.hidePill') === '1';

/**
 * The pill: a tap on a part moves that switch on. Inline at the end of a sheet, floating above the
 * home indicator on a screen.
 */
export function ProtoPill({ floating = false }: { floating?: boolean }) {
  const variants = useProto();
  const insets = useSafeAreaInsets();
  if (hidden) return null;
  const pill = (
    <View style={styles.bar}>
      {(Object.keys(SWITCHES) as Switch[]).map((name) => (
        <Pressable
          key={name}
          accessibilityLabel={`Next ${SWITCHES[name].label.toLowerCase()} variant`}
          hitSlop={8}
          onPress={() => setProto({ [name]: VARIANTS[(VARIANTS.indexOf(variants[name]) + 1) % 3] })}
        >
          <Text allowFontScaling={false} style={styles.label}>
            {SWITCHES[name].label} {variants[name]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  if (!floating) return <View style={styles.inline}>{pill}</View>;
  return (
    <View pointerEvents="box-none" style={[styles.floating, { bottom: insets.bottom + 8 }]}>
      {pill}
    </View>
  );
}

/** Forms C: a section's fields on a surface, as the Species card already is. */
export function ProtoSection({ children }: { children: ReactNode }) {
  const { forms } = useProto();
  return forms === 'C' ? <View style={protoForms.card}>{children}</View> : <>{children}</>;
}

export const protoForms = StyleSheet.create({
  /** Forms B: 32 pt above a section's heading (the form's gap is 12). */
  headingB: { marginTop: space.xl },
  card: {
    gap: space.m,
    padding: space.m,
    borderRadius: radius.surface,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  /** Forms C: the care types as rows of one outlined card, like the Care card. */
  outlineCard: {
    paddingHorizontal: space.m,
    borderRadius: radius.surface,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.outline,
  },
});

/** Chips C's fill: a pale tint, under ink rather than tinted words (the tint on it is under 4.5:1). */
export const tintFill = DynamicColorIOS({
  light: 'rgba(65, 119, 119, 0.26)',
  dark: 'rgba(127, 184, 184, 0.32)',
});

const styles = StyleSheet.create({
  inline: { alignItems: 'center', marginTop: 4 },
  floating: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0f766e',
  },
  label: { fontFamily: 'Nunito Sans', fontWeight: '700', fontSize: 13, color: '#fff' },
});
