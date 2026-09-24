import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { localTime } from '@/src/core/dates';
import { shareExport, type ShareSheet } from '@/src/core/export';
import { importExport } from '@/src/core/import';
import {
  eraseAllData,
  getSettings,
  updateSettings,
  type Settings,
  type SettingsPatch,
} from '@/src/core/settings';
import { db, withScratchDb } from '@/src/db/client';
import { ChipGroup } from '@/src/ui/Chip';
import { alertError } from '@/src/ui/Form';
import { photoFiles } from '@/src/ui/Photo';
import { colors, space, text } from '@/src/ui/theme';

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

/** The iOS share sheet, offering an Export as a zip file in the cache folder. */
const shareSheet: ShareSheet = {
  async share(name, bytes) {
    // One Export in the cache at a time: the last goes when the next is made, never while it may
    // still be on its way somewhere.
    const folder = new Directory(Paths.cache, 'export');
    if (folder.exists) folder.delete();
    folder.create();
    const zip = new File(folder, name);
    zip.write(bytes);
    await shareAsync(zip.uri);
  },
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(() => getSettings(db));
  const save = (patch: SettingsPatch) => setSettings(updateSettings(db, patch));

  // A second tap while the zip is being built would share another over the first.
  const exporting = useRef(false);
  const exportGarden = async () => {
    if (exporting.current) return;
    exporting.current = true;
    try {
      const appVersion = Constants.expoConfig?.version ?? 'unknown';
      await shareExport(db, photoFiles, shareSheet, appVersion);
    } catch (error) {
      alertError('Could not export', error);
    } finally {
      exporting.current = false;
    }
  };

  // A second tap while the picker is up would present another.
  const importing = useRef(false);
  const importGarden = async () => {
    if (importing.current) return;
    importing.current = true;
    try {
      const picked = await File.pickFileAsync({ mimeTypes: 'application/zip' });
      if (picked.canceled) return;
      const zip = picked.result;
      try {
        withScratchDb((scratch) => importExport(db, photoFiles, scratch, zip.bytesSync()));
      } finally {
        // The picker's copy; the Export itself stays wherever the user keeps it.
        if (zip.exists) zip.delete();
      }
      setSettings(getSettings(db));
      Alert.alert('Garden imported');
    } catch (error) {
      alertError('Could not import', error);
    } finally {
      importing.current = false;
    }
  };

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
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
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

      <Text style={styles.heading}>Export</Text>
      <Text style={styles.hint}>
        Every plant, Archived ones too, with its Care Log and photo, and these settings, in one zip
        file to keep wherever you like.
      </Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={exportGarden}>
        <Text style={styles.link}>Export garden</Text>
      </Pressable>

      <Text style={styles.heading}>Import</Text>
      <Text style={styles.hint}>
        Brings an export into this garden. For each plant, Care Event and photo, the newer version
        wins, deletions too, and nothing is wiped. To go back to an export exactly, erase all data
        first.
      </Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={importGarden}>
        <Text style={styles.link}>Import garden</Text>
      </Pressable>

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
  screen: { padding: space.l, gap: space.m, paddingBottom: 120 },
  heading: { ...text.title3, marginTop: space.s },
  hint: { ...text.subheadline },
  row: { gap: space.s },
  label: { ...text.callout, fontWeight: '500' },
  link: { fontSize: 16, color: colors.tint, fontWeight: '600' },
  erase: { marginTop: space.xxxl },
  danger: { fontSize: 16, color: colors.destructive, fontWeight: '600', textAlign: 'center' },
});
