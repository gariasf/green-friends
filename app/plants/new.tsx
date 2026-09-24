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
import {
  alertError,
  Field,
  optionalNumber,
  PrimaryButton,
  TextButton,
  WhenPicker,
} from '@/src/ui/Form';
import { PhotoButton, PlantPhoto, photoFiles } from '@/src/ui/Photo';
import { colors, group, pressedStyle, space, text } from '@/src/ui/theme';

/** "When did you last …?", per care type. */
const LAST_DONE: Record<CareType, string> = {
  water: 'Water it',
  fertilize: 'Fertilize it',
  repot: 'Repot it',
};

type ScheduleForm = Record<keyof CareSchedule, string>;
const EMPTY_SCHEDULE: ScheduleForm = {
  wateringGrowingDays: '',
  wateringDormantDays: '',
  fertilizingGrowingDays: '',
  fertilizingDormantDays: '',
  repottingMonths: '',
};
const INTERVAL_FIELDS: { key: keyof CareSchedule; label: string; unit: string }[] = [
  { key: 'wateringGrowingDays', label: 'Watering, Growing season', unit: 'days' },
  { key: 'wateringDormantDays', label: 'Watering, Dormant season', unit: 'days' },
  { key: 'fertilizingGrowingDays', label: 'Fertilizing, Growing season', unit: 'days' },
  { key: 'fertilizingDormantDays', label: 'Fertilizing, Dormant season', unit: 'days' },
  { key: 'repottingMonths', label: 'Repotting', unit: 'months' },
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
  /** The day each care type was last done; unanswered ones count from the plant's creation. */
  const [lastDone, setLastDone] = useState<Partial<Record<CareType, string>>>({});

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
        lastDone,
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
            // The heading above labels it; a search field shows what to type.
            placeholder="Search by name, e.g. monstera"
            accessibilityLabel="Search species"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
          />
          {matches.map((s, index) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.match,
                index > 0 && group.divider,
                pressed && pressedStyle.row,
              ]}
              onPress={() => {
                setSpecies(s);
                setQuery('');
              }}
            >
              <Text style={text.body}>{s.colloquialName}</Text>
              <Text style={text.subheadline}>{s.scientificName}</Text>
            </Pressable>
          ))}
          {query.trim() !== '' && matches.length === 0 && (
            <Text style={text.subheadline}>Nothing in the catalog matches.</Text>
          )}
          <TextButton label="Add without a species" onPress={() => setOwnSchedule(true)} />
        </>
      )}

      <Text style={styles.heading}>About this plant</Text>
      <View style={styles.photoRow}>
        <PlantPhoto uri={prepared} size={64} />
        <PhotoButton hasPhoto={prepared !== null} onPick={setPrepared} />
      </View>
      <Field
        label="Nickname"
        placeholder={ownSchedule ? 'Required' : 'Optional'}
        value={nickname}
        onChangeText={setNickname}
      />
      <Field
        label="Pot size"
        suffix="cm"
        placeholder="Optional"
        value={potSizeCm}
        onChangeText={setPotSizeCm}
        keyboardType="decimal-pad"
      />
      <Field label="Soil" placeholder="Optional" value={soil} onChangeText={setSoil} />

      {ownSchedule && (
        <>
          <Text style={styles.heading}>Care schedule</Text>
          <Text style={text.subheadline}>
            Days between waterings and feedings in the Growing and Dormant seasons, months between
            repots. Leave a care type blank if this plant never needs it, and a Dormant field blank
            to pause that care for the winter.
          </Text>
          {INTERVAL_FIELDS.map(({ key, label, unit }) => (
            <Field
              key={key}
              label={label}
              suffix={unit}
              value={schedule[key]}
              onChangeText={(value) => setSchedule((form) => ({ ...form, [key]: value }))}
              keyboardType="number-pad"
            />
          ))}
        </>
      )}

      <Text style={styles.heading}>When did you last…</Text>
      <Text style={text.subheadline}>
        Optional. Answers set the first due dates; the rest count from today.
      </Text>
      {CARE_TYPES.map((type) => (
        <WhenPicker
          key={type}
          label={LAST_DONE[type]}
          optional
          value={lastDone[type] ?? null}
          onChange={(day) => setLastDone({ ...lastDone, [type]: day ?? undefined })}
        />
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
        <Text style={text.body}>{title}</Text>
        <Text style={text.subheadline}>{subtitle}</Text>
      </View>
      <TextButton label={action} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.l, gap: space.m, paddingBottom: 48 },
  heading: { ...text.title3, marginTop: space.s },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  grow: { flex: 1 },
  match: { paddingVertical: space.s },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: 10,
    backgroundColor: colors.tintSoft,
  },
});
