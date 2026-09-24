import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { setPlantPhoto } from '@/src/core/photos';
import {
  CARE_TYPES,
  createPlant,
  type CareSchedule,
  type CareType,
  type Plant,
} from '@/src/core/plants';
import { listSpecies, type Species } from '@/src/core/species';
import { db } from '@/src/db/client';
import { alertError, Field, optionalNumber, PrimaryButton } from '@/src/ui/Form';
import { PhotoButton, PlantPhoto, photoFiles } from '@/src/ui/Photo';
import { colors, space, text } from '@/src/ui/theme';
import { WhenPicker } from '@/src/ui/WhenPicker';

/** "When did you last …?", per care type (PROTOTYPE, UI pass: any day, or not sure). */
const LAST_DONE: Record<CareType, string> = {
  water: 'Last watered',
  fertilize: 'Last fertilized',
  repot: 'Last repotted',
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
  /** The prepared photo's file, filed with the plant once it is added. */
  const [prepared, setPrepared] = useState<string | null>(null);
  const [schedule, setSchedule] = useState(EMPTY_SCHEDULE);
  const [lastDone, setLastDone] = useState<Record<CareType, string | null>>({
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
    const lastDoneDays: Partial<Record<CareType, string>> = {};
    for (const type of CARE_TYPES) {
      const day = lastDone[type];
      if (day !== null) lastDoneDays[type] = day;
    }
    let plant: Plant;
    try {
      plant = createPlant(db, {
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
    } catch (error) {
      alertError('Could not add the plant', error);
      return;
    }
    try {
      if (prepared) setPlantPhoto(db, photoFiles, plant.id, prepared);
    } catch (error) {
      // The plant is in: leave rather than offer to add it twice.
      alertError('Plant added without its photo', error, () => router.back());
      return;
    }
    router.back();
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
      <View style={styles.photoRow}>
        <PlantPhoto uri={prepared} size={64} />
        <PhotoButton hasPhoto={prepared !== null} onPick={setPrepared} />
      </View>
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
          <Text style={styles.label}>{LAST_DONE[type]}</Text>
          <WhenPicker
            optional
            value={lastDone[type]}
            onChange={(day) => setLastDone({ ...lastDone, [type]: day })}
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
  screen: { padding: space.l, gap: space.m, paddingBottom: 48 },
  heading: { ...text.title3, marginTop: space.s },
  hint: { ...text.subheadline },
  label: { ...text.callout, fontWeight: '500' },
  link: { fontSize: 16, color: colors.tint, fontWeight: '600' },
  row: { gap: space.s },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  grow: { flex: 1, gap: 2 },
  match: {
    paddingVertical: space.s,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  matchName: { ...text.callout, fontWeight: '500' },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: 10,
    backgroundColor: colors.tintSoft,
  },
});
