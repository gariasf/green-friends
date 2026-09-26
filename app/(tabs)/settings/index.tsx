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
  ShareLink,
  Spacer,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  accessibilityValue,
  datePickerStyle,
  disabled,
  environment,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, StyleSheet } from 'react-native';

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
import {
  pairingLink,
  resetSync,
  restoreSnapshot,
  snapshotLabel,
  sync,
  useSyncStatus,
} from '@/src/ui/useSync';

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

/** When the last Snapshot reached the relay, as Settings' Last synced row words it. */
function syncedLabel(syncedAt: string | null, now: Date): string {
  if (syncedAt === null) return 'Never';
  const minutes = Math.floor((now.getTime() - Date.parse(syncedAt)) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  const days = Math.floor(minutes / (24 * 60));
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

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

  const syncStatus = useSyncStatus();
  const link = syncStatus.on ? pairingLink() : null;
  // Last synced is relative to now: read again every half minute while Sync is on. A sync newer
  // than the last tick reads as Just now.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!syncStatus.on) return;
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, [syncStatus.on]);

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

  // The row shows the days being fetched and the Snapshot restored; a second tap meanwhile does
  // nothing.
  const [restoring, setRestoring] = useState(false);
  const restoreFromSync = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const days = (await sync.days()).reverse();
      if (days.length === 0) return Alert.alert('No Snapshots yet', 'Nothing has synced so far.');
      const picked = await new Promise<number>((resolve) =>
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: 'Restore from sync',
            message:
              "Merges that day's Snapshot into this Garden, as Import does: the newer version of each plant, Care Event and photo wins.",
            options: [...days.map(snapshotLabel), 'Cancel'],
            cancelButtonIndex: days.length,
          },
          resolve,
        ),
      );
      if (picked === days.length) return;
      await restoreSnapshot(days[picked]);
      setSettings(getSettings(db));
      Alert.alert('Garden restored');
    } catch (error) {
      alertError('Could not restore', error);
    } finally {
      setRestoring(false);
    }
  };

  const reset = () =>
    Alert.alert(
      'Reset sync?',
      'Every Snapshot is deleted from the relay and Sync starts again under a new Pairing link. The old link stops working, so every browser has to pair again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () =>
            resetSync().then(
              () =>
                Alert.alert(
                  'Sync reset',
                  'Save the new Pairing link somewhere safe: the old one no longer opens your Garden.',
                ),
              (error) => alertError('Could not reset sync', error),
            ),
        },
      ],
    );

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
          title="Sync"
          footer={
            <Text>
              Keeps an encrypted copy of your Garden off this iPhone, uploaded after every change.
              The relay that holds it has no way to read it.
            </Text>
          }
        >
          <Toggle
            label="Sync"
            isOn={syncStatus.on}
            onIsOnChange={(on) => (on ? void sync.turnOn() : sync.turnOff())}
          />
          {syncStatus.on && (
            <>
              <LabeledContent label="Last synced">
                <Text>{syncedLabel(syncStatus.syncedAt, now)}</Text>
              </LabeledContent>
              {syncStatus.problem !== null && <Text>{syncStatus.problem}</Text>}
              <Button label="Sync now" onPress={() => void sync.syncNow()} />
              <Button
                onPress={restoreFromSync}
                modifiers={[
                  disabled(restoring),
                  ...(restoring ? [accessibilityValue('Restoring')] : []),
                ]}
              >
                <HStack>
                  <Text>Restore from sync…</Text>
                  <Spacer />
                  {restoring && <ProgressView />}
                </HStack>
              </Button>
              <Button label="Reset sync" role="destructive" onPress={reset} />
            </>
          )}
        </Section>

        {link !== null && (
          <Section
            title="Pairing link"
            footer={
              <Text>
                Opens your Garden in a browser. Save this link somewhere safe: a new iPhone restores
                from it, and whoever has it can read your Garden.
              </Text>
            }
          >
            <ShareLink item={link}>
              <Text>Share Pairing link</Text>
            </ShareLink>
          </Section>
        )}

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
          <Button
            onPress={exportGarden}
            // The spinner alone reads as "1" to VoiceOver.
            modifiers={[disabled(zipping), ...(zipping ? [accessibilityValue('Exporting')] : [])]}
          >
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
