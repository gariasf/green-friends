import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { localDay, shiftDays } from '@/src/core/dates';
import { Chip } from '@/src/ui/Chip';
import { TINT_HEX, space, text } from '@/src/ui/theme';

/**
 * PROTOTYPE (UI pass): when a Care Event happened, as a local calendar day (ADR-0005). Today and
 * Yesterday are one tap; any other day comes from iOS's compact date picker, which never offers a
 * future day and always shows the day chosen. `optional` adds "Not sure" (null), for the New plant
 * sheet's first due dates.
 */
export function WhenPicker({
  value,
  onChange,
  optional = false,
}: {
  value: string | null;
  onChange: (day: string | null) => void;
  optional?: boolean;
}) {
  const scheme = useColorScheme();
  const today = localDay(new Date());
  const quick: { label: string; day: string | null }[] = [
    ...(optional ? [{ label: 'Not sure', day: null }] : []),
    { label: 'Today', day: today },
    { label: 'Yesterday', day: shiftDays(today, -1) },
  ];
  const [year, month, date] = (value ?? today).split('-').map(Number);
  const chips = quick.map((option) => (
    <Chip
      key={option.label}
      label={option.label}
      selected={option.day === value}
      onPress={() => onChange(option.day)}
    />
  ));
  // Sized by its SwiftUI content both ways. It loses its place in a row that wraps (seen with
  // @expo/ui 57), so where the chips fill a line it gets a line of its own.
  const picker = (
    <Host matchContents style={value === null ? styles.unset : undefined}>
      <DatePicker
        selection={new Date(year, month - 1, date, 12)}
        displayedComponents={['date']}
        range={{ end: new Date() }}
        onDateChange={(picked) => onChange(localDay(picked))}
        modifiers={[
          datePickerStyle('compact'),
          labelsHidden(),
          tint(scheme === 'dark' ? TINT_HEX.dark : TINT_HEX.light),
        ]}
      />
    </Host>
  );
  if (!optional) {
    return (
      <View style={styles.row}>
        {chips}
        {picker}
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      <View style={styles.row}>{chips}</View>
      <View style={styles.row}>
        <Text style={text.footnote}>Or pick a day</Text>
        {picker}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.s },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s },
  unset: { opacity: 0.45 },
});
