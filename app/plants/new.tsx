import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { setPlantPhoto } from '@/src/core/photos';
import {
  CARE_TYPES,
  createPlant,
  hasOverride,
  NO_SCHEDULE,
  type CareType,
  type Plant,
} from '@/src/core/plants';
import { searchSpecies, type Species } from '@/src/core/species';
import { db } from '@/src/db/client';
import { useCareSchedule } from '@/src/ui/CareSchedule';
import { EmptyState } from '@/src/ui/EmptyState';
import { alertError, Field, optionalNumber, TextButton, WhenPicker } from '@/src/ui/Form';
import { PhotoButton, PlantPhoto, photoFiles } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/PlantRow';
import { accessibilitySize, colors, group, pressedStyle, space, text } from '@/src/ui/theme';

/** "When did you last …?", per care type. */
const LAST_DONE_LABEL: Record<CareType, string> = {
  water: 'Water it',
  fertilize: 'Fertilize it',
  repot: 'Repot it',
};

/**
 * New plant: one scrolling sheet where the Species pick is the only required input (spec #8), with
 * Add in the header, always in reach, and at the top why it can't add yet (spec #22).
 */
export default function NewPlantScreen() {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchSpecies(db, query), [query]);
  const [species, setSpecies] = useState<Species | null>(null);
  const [ownSchedule, setOwnSchedule] = useState(false);
  const [nickname, setNickname] = useState('');
  const [potSizeCm, setPotSizeCm] = useState('');
  const [soil, setSoil] = useState('');
  /** The prepared photo's file, filed with the plant once it is added. */
  const [prepared, setPrepared] = useState<string | null>(null);
  // Without a Species, a plant's Overrides are its whole schedule (ADR-0003).
  const schedule = useCareSchedule(NO_SCHEDULE, null);
  /** The day each care type was last done; unanswered ones count from the plant's creation. */
  const [lastDone, setLastDone] = useState<Partial<Record<CareType, string>>>({});

  const whyNot = whyNotYet(species, ownSchedule, nickname, schedule);

  const save = () => {
    let plant: Plant;
    try {
      plant = createPlant(db, {
        speciesId: species?.id ?? null,
        nickname,
        potSizeCm: optionalNumber(potSizeCm),
        soil,
        schedule: species ? undefined : schedule.overrides,
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

  const addWithoutSpecies = () => setOwnSchedule(true);

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <TextButton
              label="Add"
              header
              disabled={whyNot !== null}
              // Why it's dimmed, for VoiceOver, which doesn't read the form's first line as it changes.
              accessibilityHint={whyNot ?? undefined}
              onPress={save}
            />
          ),
        }}
      />
      {whyNot && <Text style={text.subheadline}>{whyNot}</Text>}
      <Text accessibilityRole="header" style={styles.heading}>
        Species
      </Text>
      {species ? (
        <Picked
          title={species.colloquialName}
          subtitle={scientificBeneath(species.colloquialName, species.scientificName)}
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
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {matches.map((s, index) => {
            const scientific = scientificBeneath(s.colloquialName, s.scientificName);
            return (
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
                {scientific && <Text style={text.subheadline}>{scientific}</Text>}
              </Pressable>
            );
          })}
          {query.trim() !== '' && matches.length === 0 ? (
            <EmptyState
              symbol="magnifyingglass"
              title="Not in the catalog"
              line="Check the spelling, or add it without a species and give it its own schedule."
              action={{ label: 'Add without a species', onPress: addWithoutSpecies }}
            />
          ) : (
            <TextButton label="Add without a species" onPress={addWithoutSpecies} />
          )}
        </>
      )}

      <Text accessibilityRole="header" style={styles.heading}>
        About this plant
      </Text>
      <View style={styles.photoRow}>
        <PlantPhoto uri={prepared} size={64} />
        <PhotoButton hasPhoto={prepared !== null} onPick={setPrepared} />
      </View>
      <Field
        label="Nickname"
        placeholder={ownSchedule ? 'Required' : 'Optional'}
        value={nickname}
        onChangeText={setNickname}
        autoCapitalize="words"
        // iOS would offer contacts' names.
        textContentType="none"
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
          <Text accessibilityRole="header" style={styles.heading}>
            Care schedule
          </Text>
          {schedule.fields}
        </>
      )}

      <Text accessibilityRole="header" style={styles.heading}>
        When did you last…
      </Text>
      <Text style={text.subheadline}>
        Optional. Answers set the first due dates; the rest count from today.
      </Text>
      {CARE_TYPES.map((type) => (
        <WhenPicker
          key={type}
          label={LAST_DONE_LABEL[type]}
          optional
          value={lastDone[type] ?? null}
          onChange={(day) => setLastDone({ ...lastDone, [type]: day ?? undefined })}
        />
      ))}
    </ScrollView>
  );
}

/**
 * Why the plant can't be added yet, or null once it can: without a Species it needs what the core
 * asks of one (validatePlant), a nickname and its own schedule for a care type at least.
 */
function whyNotYet(
  species: Species | null,
  ownSchedule: boolean,
  nickname: string,
  schedule: ReturnType<typeof useCareSchedule>,
): string | null {
  if (species) return null;
  if (!ownSchedule) return 'Pick a species, or add without one and give it a nickname.';
  if (!nickname.trim()) return 'Give it a nickname to add it without a species.';
  if (schedule.problem) return schedule.problem;
  if (!CARE_TYPES.some((type) => hasOverride(schedule.overrides, type))) {
    return 'Give it its own schedule for at least one care type.';
  }
  return null;
}

function Picked({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string | null;
  action: string;
  onAction: () => void;
}) {
  // Beside the action, the title breaks mid-word at accessibility text sizes, so there it stacks.
  const stacked = accessibilitySize(useWindowDimensions().fontScale);
  return (
    <View style={[styles.picked, stacked && styles.pickedStacked]}>
      <View style={!stacked && styles.grow}>
        <Text style={text.body}>{title}</Text>
        {subtitle && <Text style={text.subheadline}>{subtitle}</Text>}
      </View>
      <TextButton label={action} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.l, gap: space.m, paddingBottom: space.xxxl },
  heading: { ...group.header, marginTop: space.s },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  grow: { flex: 1 },
  // One line tall for a Species known by its scientific name; still a 44 pt target.
  match: { minHeight: 44, justifyContent: 'center', paddingVertical: space.s },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: 10,
    backgroundColor: colors.tintSoft,
  },
  pickedStacked: { flexDirection: 'column', alignItems: 'flex-start' },
});
