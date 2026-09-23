import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { localDay, shiftDays } from '@/src/core/dates';
import { CARE_TYPES, createPlant, type CareSchedule, type CareType } from '@/src/core/plants';
import { listSpecies, type Species } from '@/src/core/species';
import { db } from '@/src/db/client';
import { ChipGroup } from '@/src/ui/Chip';
import { Field, optionalNumber, PrimaryButton } from '@/src/ui/Form';

/** "When did you last …?" quick answers, in days ago; null leaves that care type unanswered. */
type Ago = { label: string; value: number | null };
const NOT_SURE: Ago = { label: 'Not sure', value: null };
const DAYS_AGO: Ago[] = [
  NOT_SURE,
  { label: 'Today', value: 0 },
  { label: 'Yesterday', value: 1 },
  { label: '3 days ago', value: 3 },
  { label: '1 week ago', value: 7 },
  { label: '2 weeks ago', value: 14 },
  { label: '1 month ago', value: 30 },
];
// Approximate day counts: a repot "about a year ago" needs no calendar-month arithmetic.
const MONTHS_AGO: Ago[] = [
  NOT_SURE,
  { label: 'This month', value: 0 },
  { label: '6 months ago', value: 182 },
  { label: '1 year ago', value: 365 },
  { label: '2 years ago', value: 730 },
];
const LAST_DONE: Record<CareType, { label: string; options: Ago[] }> = {
  water: { label: 'Water it', options: DAYS_AGO },
  fertilize: { label: 'Fertilize it', options: DAYS_AGO },
  repot: { label: 'Repot it', options: MONTHS_AGO },
};

type ScheduleForm = Record<keyof CareSchedule, string>;
const EMPTY_SCHEDULE: ScheduleForm = {
  wateringGrowingDays: '',
  wateringDormantDays: '',
  fertilizingGrowingDays: '',
  fertilizingDormantDays: '',
  repottingMonths: '',
};
const INTERVAL_FIELDS: { key: keyof CareSchedule; label: string }[] = [
  { key: 'wateringGrowingDays', label: 'Watering, Growing season (days)' },
  { key: 'wateringDormantDays', label: 'Watering, Dormant season (days)' },
  { key: 'fertilizingGrowingDays', label: 'Fertilizing, Growing season (days)' },
  { key: 'fertilizingDormantDays', label: 'Fertilizing, Dormant season (days)' },
  { key: 'repottingMonths', label: 'Repotting (months)' },
];

/** New plant: one scrolling sheet where the Species pick is the only required input (spec #8). */
export default function NewPlantScreen() {
  const catalog = useMemo(() => listSpecies(db), []);
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState<Species | null>(null);
  const [ownSchedule, setOwnSchedule] = useState(false);
  const [nickname, setNickname] = useState('');
  const [potSizeCm, setPotSizeCm] = useState('');
  const [soil, setSoil] = useState('');
  const [schedule, setSchedule] = useState(EMPTY_SCHEDULE);
  const [lastDone, setLastDone] = useState<Record<CareType, number | null>>({
    water: null,
    fertilize: null,
    repot: null,
  });

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return catalog
      .filter(
        (s) =>
          s.colloquialName.toLowerCase().includes(needle) ||
          s.scientificName.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [catalog, query]);

  const canSave = species !== null || (ownSchedule && nickname.trim() !== '');

  const save = () => {
    const today = localDay(new Date());
    const lastDoneDays: Partial<Record<CareType, string>> = {};
    for (const type of CARE_TYPES) {
      const ago = lastDone[type];
      if (ago !== null) lastDoneDays[type] = shiftDays(today, -ago);
    }
    try {
      createPlant(db, {
        speciesId: species?.id ?? null,
        nickname,
        potSizeCm: optionalNumber(potSizeCm),
        soil,
        schedule: ownSchedule
          ? {
              wateringGrowingDays: optionalNumber(schedule.wateringGrowingDays),
              wateringDormantDays: optionalNumber(schedule.wateringDormantDays),
              fertilizingGrowingDays: optionalNumber(schedule.fertilizingGrowingDays),
              fertilizingDormantDays: optionalNumber(schedule.fertilizingDormantDays),
              repottingMonths: optionalNumber(schedule.repottingMonths),
            }
          : undefined,
        lastDone: lastDoneDays,
      });
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not add the plant',
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.heading}>Species</Text>
      {species ? (
        <Picked
          title={species.colloquialName}
          subtitle={species.scientificName}
          action="Change"
          onAction={() => setSpecies(null)}
        />
      ) : ownSchedule ? (
        <Picked
          title="No species"
          subtitle="This plant carries its own care schedule."
          action="Pick a species"
          onAction={() => setOwnSchedule(false)}
        />
      ) : (
        <>
          <Field
            placeholder="Search by name, e.g. monstera"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
          />
          {matches.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              style={styles.match}
              onPress={() => {
                setSpecies(s);
                setQuery('');
              }}
            >
              <Text style={styles.matchName}>{s.colloquialName}</Text>
              <Text style={styles.hint}>{s.scientificName}</Text>
            </Pressable>
          ))}
          {query.trim() !== '' && matches.length === 0 && (
            <Text style={styles.hint}>Nothing in the catalog matches.</Text>
          )}
          <Pressable accessibilityRole="button" onPress={() => setOwnSchedule(true)}>
            <Text style={styles.link}>Add without a species</Text>
          </Pressable>
        </>
      )}

      <Text style={styles.heading}>About this plant</Text>
      <Field
        placeholder={ownSchedule ? 'Nickname (required)' : 'Nickname (optional)'}
        value={nickname}
        onChangeText={setNickname}
      />
      <Field
        placeholder="Pot size in cm (optional)"
        value={potSizeCm}
        onChangeText={setPotSizeCm}
        keyboardType="decimal-pad"
      />
      <Field placeholder="Soil (optional)" value={soil} onChangeText={setSoil} />

      {ownSchedule && (
        <>
          <Text style={styles.heading}>Care schedule</Text>
          <Text style={styles.hint}>
            Days between waterings and feedings in the Growing and Dormant seasons, months between
            repots. Leave a care type blank if this plant never needs it, and a Dormant field blank
            to pause that care for the winter.
          </Text>
          {INTERVAL_FIELDS.map(({ key, label }) => (
            <View key={key} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Field
                value={schedule[key]}
                onChangeText={(value) => setSchedule((form) => ({ ...form, [key]: value }))}
                keyboardType="number-pad"
              />
            </View>
          ))}
        </>
      )}

      <Text style={styles.heading}>When did you last…</Text>
      <Text style={styles.hint}>
        Optional. Answers set the first due dates; the rest count from today.
      </Text>
      {CARE_TYPES.map((type) => (
        <View key={type} style={styles.row}>
          <Text style={styles.label}>{LAST_DONE[type].label}</Text>
          <ChipGroup
            options={LAST_DONE[type].options}
            value={lastDone[type]}
            onChange={(value) => setLastDone({ ...lastDone, [type]: value })}
          />
        </View>
      ))}

      <PrimaryButton label="Add plant" disabled={!canSave} onPress={save} />
    </ScrollView>
  );
}

function Picked({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.picked}>
      <View style={styles.grow}>
        <Text style={styles.matchName}>{title}</Text>
        <Text style={styles.hint}>{subtitle}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onAction}>
        <Text style={styles.link}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12, paddingBottom: 48 },
  heading: { fontSize: 20, fontWeight: '600', marginTop: 8 },
  hint: { fontSize: 14, color: '#666' },
  label: { fontSize: 16, fontWeight: '500' },
  link: { fontSize: 16, color: '#2e7d32', fontWeight: '600' },
  row: { gap: 8 },
  grow: { flex: 1, gap: 2 },
  match: { paddingVertical: 8, gap: 2, borderBottomWidth: 1, borderColor: '#eee' },
  matchName: { fontSize: 16, fontWeight: '500' },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#e8f5e9',
  },
});
