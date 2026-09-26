import { Icon } from '@/src/ui/Icon';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font } from './theme';

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

const styles = StyleSheet.create({
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
