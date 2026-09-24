import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { localTime } from '@/src/core/dates';
import {
  eraseAllData,
  getSettings,
  updateSettings,
  type Settings,
  type SettingsPatch,
} from '@/src/core/settings';
import { db } from '@/src/db/client';
import { ChipGroup } from '@/src/ui/Chip';
import { alertError } from '@/src/ui/Form';
import { photoFiles } from '@/src/ui/Photo';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
].map((label, index) => ({ label, value: index + 1 }));

/**
 * Daily Digest times on the hour, 06:00 to 22:00, labelled the way the phone shows times.
 * ponytail: whole hours only; a time picker the day someone wants 07:30.
 */
const HOURS = Array.from({ length: 17 }, (_, index) => new Date(2000, 0, 1, index + 6)).map(
  (at) => ({
    label: at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    value: localTime(at),
  }),
);

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(() => getSettings(db));
  const save = (patch: SettingsPatch) => setSettings(updateSettings(db, patch));

  const erase = () =>
    Alert.alert(
      'Erase all data?',
      'All plants, Archived ones too, with their Care Logs and photos, and these settings are erased from this iPhone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: () => {
            try {
              eraseAllData(db, photoFiles);
            } catch (error) {
              alertError('Could not erase all data', error);
            }
            setSettings(getSettings(db));
          },
        },
      ],
    );

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

      <Text style={styles.heading}>Daily digest</Text>
      <Text style={styles.hint}>
        One notification at this time, and only on days a plant needs you.
      </Text>
      <ChipGroup
        options={HOURS}
        value={settings.digestTime}
        onChange={(digestTime) => save({ digestTime })}
      />

      <Pressable accessibilityRole="button" hitSlop={8} onPress={erase} style={styles.erase}>
        <Text style={styles.danger}>Erase all data</Text>
      </Pressable>
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
      <ChipGroup options={MONTHS} value={value} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12, paddingBottom: 48 },
  heading: { fontSize: 20, fontWeight: '600', marginTop: 8 },
  hint: { fontSize: 14, color: '#666' },
  row: { gap: 8 },
  label: { fontSize: 16, fontWeight: '500' },
  erase: { marginTop: 32 },
  danger: { fontSize: 16, color: '#e0342b', fontWeight: '600', textAlign: 'center' },
});
