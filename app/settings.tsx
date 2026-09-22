import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getSettings,
  updateSettings,
  type Settings,
  type SettingsPatch,
} from '@/src/core/settings';
import { db } from '@/src/db/client';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(() => getSettings(db));
  const save = (patch: SettingsPatch) => setSettings(updateSettings(db, patch));

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.heading}>Growing season</Text>
      <Text style={styles.hint}>
        Watering and fertilizing follow the Growing interval in these months and the Dormant
        interval outside them.
      </Text>
      <MonthRow
        label="Starts"
        value={settings.growingStartMonth}
        onChange={(growingStartMonth) => save({ growingStartMonth })}
      />
      <MonthRow
        label="Ends"
        value={settings.growingEndMonth}
        onChange={(growingEndMonth) => save({ growingEndMonth })}
      />
    </ScrollView>
  );
}

function MonthRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (month: number) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {MONTHS.map((name, index) => {
          const month = index + 1;
          const selected = month === value;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(month)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12 },
  heading: { fontSize: 20, fontWeight: '600', marginTop: 8 },
  hint: { fontSize: 14, color: '#666' },
  row: { gap: 8 },
  label: { fontSize: 16, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbb',
  },
  chipSelected: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  chipText: { fontSize: 15 },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
});
