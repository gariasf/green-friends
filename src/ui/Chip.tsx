import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space } from '@/src/ui/theme';

/** A selectable pill, for a handful of quick picks; bigger choices get native controls. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

/** A wrapping row of chips where exactly one option is selected. */
export function ChipGroup<T>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      {options.map((option) => (
        <Chip
          key={option.label}
          label={option.label}
          selected={Object.is(option.value, value)}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.m + 2,
    borderRadius: 18,
    backgroundColor: colors.fill,
  },
  chipSelected: { backgroundColor: colors.tint },
  pressed: { opacity: 0.6 },
  text: { fontSize: 15, fontWeight: '500', color: colors.label },
  textSelected: { color: colors.onTint, fontWeight: '600' },
});
