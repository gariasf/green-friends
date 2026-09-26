import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { setPlantPhoto } from '@/src/core/photos';
import {
  CARE_TYPES,
  createPlant,
  hasOverride,
  NO_SCHEDULE,
  type CareType,
  type Plant,
} from '@/src/core/plants';
import { type Species } from '@/src/core/species';
import { db } from '@/src/db/client';
import { useCareSchedule } from '@/src/ui/CareSchedule';
import { alertError, Field, optionalNumber, TextButton, WhenPicker } from '@/src/ui/Form';
import { PhotoButton, PlantPhoto, photoFiles } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/words';
import { PickedSpecies, SpeciesSearch } from '@/src/ui/SpeciesPicker';
import { colors, group, pressedStyle, space, text } from '@/src/ui/theme';
import { useIdentify, type IdentifyState } from '@/src/ui/useIdentify';

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
  const [species, setSpecies] = useState<Species | null>(null);
  const [ownSchedule, setOwnSchedule] = useState(false);
  const [nickname, setNickname] = useState('');
  const [potSizeCm, setPotSizeCm] = useState('');
  const [soil, setSoil] = useState('');
  /** The prepared photo's file, filed with the plant once it is added. */
  const [prepared, setPrepared] = useState<string | null>(null);
  const identify = useIdentify();
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
  const pickSpecies = (picked: Species) => {
    setSpecies(picked);
    setOwnSchedule(false);
  };
  // Suggestions belong to the photo they came from.
  const pickPhoto = (next: string) => {
    identify.clear();
    setPrepared(next);
  };

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
        <PickedSpecies
          title={species.colloquialName}
          subtitle={scientificBeneath(species.colloquialName, species.scientificName)}
          action="Change"
          onAction={() => setSpecies(null)}
        />
      ) : ownSchedule ? (
        <PickedSpecies
          title="No species"
          subtitle="This plant carries its own care schedule."
          action="Pick a species"
          onAction={() => setOwnSchedule(false)}
        />
      ) : (
        <SpeciesSearch
          onPick={pickSpecies}
          fallback={{
            label: 'Add without a species',
            line: 'Check the spelling, or add it without a species and give it its own schedule.',
            onPress: addWithoutSpecies,
          }}
        />
      )}

      <Text accessibilityRole="header" style={styles.heading}>
        About this plant
      </Text>
      <View style={styles.photoRow}>
        <PlantPhoto uri={prepared} size={64} />
        <PhotoButton hasPhoto={prepared !== null} onPick={pickPhoto} />
      </View>
      {prepared && (
        <IdentifyFromPhoto
          state={identify.state}
          onIdentify={() => identify.run(prepared)}
          onPick={(picked) => {
            pickSpecies(picked);
            identify.clear();
          }}
          onDismiss={identify.clear}
        />
      )}
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
 * Identify from photo (ADR-0007): the row that sends the photo, only on its tap, and beneath it the
 * Suggestions, "Not in the catalog", or why it didn't work, inline.
 */
function IdentifyFromPhoto({
  state,
  onIdentify,
  onPick,
  onDismiss,
}: {
  state: IdentifyState;
  onIdentify: () => void;
  onPick: (species: Species) => void;
  onDismiss: () => void;
}) {
  const running = state.kind === 'running';
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? 'Identifying' : 'Identify from photo'}
        accessibilityState={{ disabled: running, busy: running }}
        disabled={running}
        onPress={onIdentify}
        style={({ pressed }) => [styles.identify, pressed && pressedStyle.button]}
      >
        <Text style={[styles.identifyLabel, running && styles.identifyRunning]}>
          Identify from photo
        </Text>
        {running && <ActivityIndicator accessibilityLabel="Identifying" />}
      </Pressable>
      {state.kind === 'failed' && <Text style={text.subheadline}>{state.message}</Text>}
      {state.kind === 'suggestions' && (
        <>
          {state.suggestions.length === 0 ? (
            <Text style={text.subheadline}>Not in the catalog</Text>
          ) : (
            <View>
              {state.suggestions.map(({ species, confidence }, index) => {
                const scientific = scientificBeneath(
                  species.colloquialName,
                  species.scientificName,
                );
                return (
                  <Pressable
                    key={species.id}
                    accessibilityRole="button"
                    accessibilityLabel={[species.colloquialName, scientific, confidence]
                      .filter(Boolean)
                      .join(', ')}
                    style={({ pressed }) => [
                      styles.suggestion,
                      index > 0 && group.divider,
                      pressed && pressedStyle.row,
                    ]}
                    onPress={() => onPick(species)}
                  >
                    <View style={styles.grow}>
                      <Text style={text.body}>{species.colloquialName}</Text>
                      {scientific && <Text style={text.subheadline}>{scientific}</Text>}
                    </View>
                    <Text style={text.subheadline}>{confidence}</Text>
                  </Pressable>
                );
              })}
              <TextButton label="None of these" onPress={onDismiss} style={styles.none} />
            </View>
          )}
          <Text style={text.footnote}>Identified with Pl@ntNet</Text>
        </>
      )}
    </>
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

const styles = StyleSheet.create({
  screen: { padding: space.l, gap: space.m, paddingBottom: space.xxxl },
  heading: { ...group.header, marginTop: space.s },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  identify: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.s },
  identifyLabel: { ...text.body, color: colors.tint },
  identifyRunning: { color: colors.tertiaryLabel },
  grow: { flex: 1 },
  suggestion: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.s,
  },
  none: { marginTop: space.s, alignSelf: 'flex-start' },
});
