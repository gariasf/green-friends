import {
  Button,
  DatePicker,
  Form,
  Host,
  HStack,
  LabeledContent,
  Picker,
  ProgressView,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui';
import {
  datePickerStyle,
  disabled,
  environment,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { shareExport, type ShareSheet } from '@/src/core/export';
import { importExport } from '@/src/core/import';
import {
  eraseAllData,
  getSettings,
  updateSettings,
  type Settings,
  type SettingsPatch,
} from '@/src/core/settings';
import { getSpeciesDatasetVersion } from '@/src/core/species';
import { db, withScratchDb } from '@/src/db/client';
import { alertError } from '@/src/ui/Form';
import { photoFiles } from '@/src/ui/Photo';
import { colors } from '@/src/ui/theme';

/**
 * The months as the phone names them, for the season pickers. Each is named from its 15th: Hermes
 * reads a past year's local time at today's offset, and where a zone's offset has changed since,
 * the 1st at midnight is formatted as the last day of the month before.
 */
const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  label: new Date(2000, index, 15).toLocaleDateString(undefined, { month: 'long' }),
  value: index + 1,
}));

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

/**
 * The iOS share sheet, offering an Export as a zip file in the cache folder; `presenting` runs as
 * the sheet comes up, once the zip is made.
 */
function shareSheet(presenting: () => void): ShareSheet {
  return {
    async share(name, bytes) {
      // One Export in the cache at a time: the last goes when the next is made, never while it may
      // still be on its way somewhere.
      const folder = new Directory(Paths.cache, 'export');
      if (folder.exists) folder.delete();
      folder.create();
      const zip = new File(folder, name);
      zip.write(bytes);
      presenting();
      await shareAsync(zip.uri);
    },
  };
}

/**
 * Settings as iOS Settings draws them: a SwiftUI Form, whose scrolling UIKit and
 * react-native-screens find as they find a ScrollView's, so the large title still collapses and a
 * tap on the tab still scrolls back up.
 */
export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(() => getSettings(db));
  const [catalogVersion] = useState(() => getSpeciesDatasetVersion(db));
  const save = (patch: SettingsPatch) => setSettings(updateSettings(db, patch));

  // The row shows the zip being made until the share sheet is up. A second tap until the sheet is
  // dismissed would share another over the first.
  const [zipping, setZipping] = useState(false);
  const exporting = useRef(false);
  const exportGarden = async () => {
    if (exporting.current) return;
    exporting.current = true;
    setZipping(true);
    try {
      // The zip is made on the JS thread, which renders nothing until it is done: the spinner goes
      // up first.
      await new Promise((resolve) => setTimeout(resolve));
      await shareExport(
        db,
        photoFiles,
        shareSheet(() => setZipping(false)),
        APP_VERSION,
      );
    } catch (error) {
      alertError('Could not export', error);
    } finally {
      exporting.current = false;
      setZipping(false);
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
    <Host style={styles.form} seedColor={colors.tint}>
      <Form>
        <Section
          title="Growing season"
          footer={
            <Text>
              Watering and fertilizing follow the Growing interval in these months and the Dormant
              interval outside them. The same month for both means Growing all year.
            </Text>
          }
        >
          <MonthPicker
            label="Starts"
            value={settings.growingStartMonth}
            onChange={(growingStartMonth) => save({ growingStartMonth })}
          />
          <MonthPicker
            label="Ends"
            value={settings.growingEndMonth}
            onChange={(growingEndMonth) => save({ growingEndMonth })}
          />
        </Section>

        <Section
          title="Daily Digest"
          footer={<Text>One notification at this time, and only on days a plant needs you.</Text>}
        >
          <DatePicker
            title="Time"
            displayedComponents={['hourAndMinute']}
            // A time of day, not an instant: the picker keeps to UTC, where no offset applies. Set
            // on a past day in local time, it showed an hour off where the zone's offset has since
            // changed, as Hermes reads that day at today's offset and iOS at the day's own.
            selection={new Date(`1970-01-01T${settings.digestTime}Z`)}
            onDateChange={(time) => save({ digestTime: time.toISOString().slice(11, 16) })}
            modifiers={[datePickerStyle('compact'), environment('timeZone', 'UTC')]}
          />
        </Section>

        <Section
          title="Backup"
          footer={
            <Text>
              Import merges an export into this garden: for each plant, Care Event and photo the
              newer version wins, deletions too, and nothing is wiped. To go back to an export
              exactly, erase all data first.
            </Text>
          }
        >
          <Button onPress={exportGarden} modifiers={[disabled(zipping)]}>
            <HStack>
              <Text>Export garden</Text>
              <Spacer />
              {zipping && <ProgressView />}
            </HStack>
          </Button>
          <Button label="Import garden" onPress={importGarden} />
        </Section>

        <Section
          footer={
            <Text>
              Erases every plant, Archived ones too, with its Care Log and photo, and these
              settings. Export first to keep a copy.
            </Text>
          }
        >
          <Button label="Erase all data" role="destructive" onPress={erase} />
        </Section>

        <Section
          title="About"
          footer={<Text>Species IDs and scientific names come from Wikidata, under CC0.</Text>}
        >
          <LabeledContent label="Version">
            <Text>{APP_VERSION}</Text>
          </LabeledContent>
          <LabeledContent label="Species catalog">
            <Text>{`Version ${catalogVersion}`}</Text>
          </LabeledContent>
        </Section>
      </Form>
    </Host>
  );
}

/** A Growing season month, picked from a menu. */
function MonthPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (month: number) => void;
}) {
  return (
    <Picker
      label={label}
      selection={value}
      onSelectionChange={onChange}
      modifiers={[pickerStyle('menu')]}
    >
      {MONTHS.map((month) => (
        <Text key={month.value} modifiers={[tag(month.value)]}>
          {month.label}
        </Text>
      ))}
    </Picker>
  );
}

const styles = StyleSheet.create({
  form: { flex: 1 },
});
