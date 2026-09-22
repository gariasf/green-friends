import { Pressable, StyleSheet, Text, View } from 'react-native';

/** A selectable pill. */
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
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
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
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbb',
  },
  chipSelected: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  text: { fontSize: 15 },
  textSelected: { color: '#fff', fontWeight: '600' },
});
