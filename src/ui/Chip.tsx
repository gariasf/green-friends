import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tintFill, useProto } from '@/src/ui/FormsPrototype';
import { colors, font, pressedStyle, radius, space, text } from '@/src/ui/theme';

/** A selectable pill on a fill. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  // PROTOTYPE chips: A solid tint, B a tint ring on the fill, C a pale tint fill in ink.
  const { chips } = useProto();
  const selectedStyle = { A: styles.chipSelected, B: styles.chipRing, C: styles.chipTinted }[chips];
  const selectedLabel = { A: styles.labelSelected, B: styles.labelRing, C: styles.labelTinted }[
    chips
  ];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // 36 pt tall; this makes it a 44 pt target.
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && selectedStyle,
        pressed && pressedStyle.button,
      ]}
    >
      <Text style={[styles.label, selected && selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

/** A wrapping row of chips where at most one option is selected; a new pick ticks like a picker. */
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
          onPress={() => {
            if (!Object.is(option.value, value)) Haptics.selectionAsync();
            onChange(option.value);
          }}
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
    paddingHorizontal: space.m,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  chipSelected: { backgroundColor: colors.tint },
  label: { ...text.subheadline, color: colors.label },
  labelSelected: { ...font.semibold, color: colors.onTint },
  // An outline draws outside the layout, so the ring moves nothing; the offset keeps it inside.
  chipRing: {
    outlineColor: colors.tint,
    outlineWidth: 1.5,
    outlineOffset: -1.5,
    outlineStyle: 'solid',
  },
  labelRing: { ...font.semibold, color: colors.tint },
  chipTinted: { backgroundColor: tintFill },
  labelTinted: { ...font.semibold, color: colors.label },
});
