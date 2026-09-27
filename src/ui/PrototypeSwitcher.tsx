import { Icon } from '@/src/ui/Icon';
import Storage from 'expo-sqlite/kv-store';
import { useState } from 'react';
import { DevSettings, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, WEIGHT_SETS, weightSet, WEIGHTS_KEY, type WeightSetKey } from './theme';

/**
 * PROTOTYPE (UI pass): flips between the design variants of one screen. Not part of any design,
 * and never merged: the variant chosen per screen lives in memory only.
 */
const chosen = new Map<string, number>();

export function usePrototypeVariant(screen: string) {
  const [index, setIndex] = useState(chosen.get(screen) ?? 0);
  const choose = (next: number) => {
    chosen.set(screen, next);
    setIndex(next);
  };
  return [index, choose] as const;
}

export function PrototypeSwitcher({
  labels,
  index,
  onChange,
}: {
  labels: string[];
  index: number;
  onChange: (index: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const go = (step: number) => onChange((index + step + labels.length) % labels.length);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 4 }]}>
      <View style={styles.bar}>
        <Pressable accessibilityLabel="Previous variant" hitSlop={12} onPress={() => go(-1)}>
          <Icon name="previous" size={14} color="#fff" weight="bold" />
        </Pressable>
        <Text style={styles.label}>
          {String.fromCharCode(65 + index)} · {labels[index]}
        </Text>
        <Pressable accessibilityLabel="Next variant" hitSlop={12} onPress={() => go(1)}>
          <Icon name="next" size={14} color="#fff" weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

const WEIGHT_KEYS = Object.keys(WEIGHT_SETS) as WeightSetKey[];

/**
 * PROTOTYPE (ticket #54): flips the whole app between the weight sets, above the tab bar. The
 * type scale is built once at startup, so a pick is stored and the app reloads.
 */
export function WeightsSwitcher() {
  const insets = useSafeAreaInsets();
  const index = WEIGHT_KEYS.indexOf(weightSet);
  const go = (step: number) => {
    Storage.setItemSync(
      WEIGHTS_KEY,
      WEIGHT_KEYS[(index + step + WEIGHT_KEYS.length) % WEIGHT_KEYS.length],
    );
    DevSettings.reload();
  };
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 56 }]}>
      <View style={[styles.bar, styles.weights]}>
        <Pressable accessibilityLabel="Previous weight set" hitSlop={12} onPress={() => go(-1)}>
          <Icon name="previous" size={14} color="#fff" weight="bold" />
        </Pressable>
        <Text allowFontScaling={false} style={styles.label}>
          Weights {weightSet} · {WEIGHT_SETS[weightSet].label}
        </Text>
        <Pressable accessibilityLabel="Next weight set" hitSlop={12} onPress={() => go(1)}>
          <Icon name="next" size={14} color="#fff" weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weights: { backgroundColor: '#0f766e' },
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#6d28d9',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  label: { color: '#fff', fontSize: 13, ...font.bold },
});
