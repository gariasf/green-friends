import { Stack } from 'expo-router';
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
import {
  alertError,
  Field,
  optionalNumber,
  potSizeProblem,
  TextButton,
  useConfirmDiscard,
  WhenPicker,
} from '@/src/ui/Form';
import { ProtoPill, protoForms, ProtoSection, useProto } from '@/src/ui/FormsPrototype';
import { PlantPhoto, photoFiles, usePhotoPicker, type Picked } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/words';
import { PickedSpecies, SpeciesSearch } from '@/src/ui/SpeciesPicker';
import { colors, group, pressedStyle, space, text } from '@/src/ui/theme';
import { useIdentify, type IdentifyState } from '@/src/ui/useIdentify';

/** "When did you last …?", per care type; PROTOTYPE words B and C say it their ways. */
const LAST_DONE_LABEL: Record<'A' | 'B' | 'C', Record<CareType, string>> = {
  A: { water: 'Water it', fertilize: 'Fertilize it', repot: 'Repot it' },
  B: { water: 'Last watered', fertilize: 'Last fertilized', repot: 'Last repotted' },
  C: {
    water: 'When did you last water it?',
    fertilize: 'When did you last fertilize it?',
    repot: 'When did you last repot it?',
  },
};

/**
 * New plant: one scrolling sheet where the Species pick is the only required input (spec #8), with
 * Add in the header, always in reach, and at the top why it can't add yet (spec #22). Closing it
 * once anything is in asks first (#90).
 */
export default function NewPlantScreen() {
  const [species, setSpecies] = useState<Species | null>(null);
  /** Searching again after a pick, with the way back to it. */
  const [searching, setSearching] = useState(false);
  const [ownSchedule, setOwnSchedule] = useState(false);
  const [nickname, setNickname] = useState('');
  const [potSizeCm, setPotSizeCm] = useState('');
  const [soil, setSoil] = useState('');
  /** The prepared photo and its Focal point, filed with the plant once it is added. */
  const [picked, setPicked] = useState<Picked | null>(null);
  const prepared = picked?.prepared ?? null;
  const identify = useIdentify();
  // Without a Species, a plant's Overrides are its whole schedule (ADR-0003).
  const schedule = useCareSchedule(NO_SCHEDULE, null);
  /** The day each care type was last done; unanswered ones count from the plant's creation. */
  const [lastDone, setLastDone] = useState<Partial<Record<CareType, string>>>({});

  // PROTOTYPE species C: no switch; without a Species, the plant takes its own schedule.
  const { forms, species: speciesVariant, words } = useProto();
  const own = speciesVariant === 'C' ? species === null : ownSchedule;
  const heading = [styles.heading, forms === 'B' && protoForms.headingB];
  const whyNot =
    potSizeProblem(potSizeCm) ?? whyNotYet(species, own, nickname, schedule, speciesVariant);
  const leave = useConfirmDiscard(
    species !== null ||
      ownSchedule ||
      schedule.changed ||
      picked !== null ||
      [nickname, potSizeCm, soil].some((field) => field.trim() !== '') ||
      Object.values(lastDone).some(Boolean),
    'Discard this plant?',
  );

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
      if (picked) setPlantPhoto(db, photoFiles, plant.id, picked.prepared, picked.focus);
    } catch (error) {
      // The plant is in: leave rather than offer to add it twice.
      alertError('Plant added without its photo', error, leave);
      return;
    }
    leave();
  };

  const addWithoutSpecies = () => setOwnSchedule(true);
  const pickSpecies = (picked: Species) => {
    setSpecies(picked);
    setSearching(false);
    setOwnSchedule(false);
  };
  // Suggestions belong to the photo they came from.
  const photoPicker = usePhotoPicker((next: Picked) => {
    identify.clear();
    setPicked(next);
  });

  return (
    <View style={styles.fill}>
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
                bold
                disabled={whyNot !== null}
                // Why it's dimmed, for VoiceOver, which doesn't read the form's first line as it changes.
                accessibilityHint={whyNot ?? undefined}
                onPress={save}
              />
            ),
          }}
        />
        {whyNot && (
          <Text lineBreakStrategyIOS="standard" style={text.subheadline}>
            {whyNot}
          </Text>
        )}
        <Text accessibilityRole="header" style={heading}>
          Species
        </Text>
        {species && !searching ? (
          <PickedSpecies
            title={species.colloquialName}
            scientific={scientificBeneath(species.colloquialName, species.scientificName)}
            action="Change"
            actionLabel="Change species"
            onAction={() => setSearching(true)}
          />
        ) : ownSchedule && speciesVariant !== 'C' ? (
          <PickedSpecies
            title="No species"
            subtitle="This plant carries its own care schedule."
            action="Pick a species"
            onAction={() => setOwnSchedule(false)}
          />
        ) : (
          <SpeciesSearch
            onPick={pickSpecies}
            fallback={
              species
                ? {
                    label: `Keep ${species.colloquialName}`,
                    line: 'Check the spelling, or search by its scientific name.',
                    onPress: () => setSearching(false),
                  }
                : {
                    A: {
                      label: 'Add without a species',
                      line: 'Check the spelling, or add it without a species and give it its own schedule.',
                      onPress: addWithoutSpecies,
                    },
                    B: {
                      label: 'Give it its own schedule',
                      line: 'Check the spelling, or give it its own schedule and a nickname.',
                      onPress: addWithoutSpecies,
                    },
                    C: {
                      label: '',
                      line: 'Check the spelling, or give it a nickname and its own schedule below.',
                      onPress: addWithoutSpecies,
                    },
                  }[speciesVariant]
            }
          />
        )}

        <Text accessibilityRole="header" style={heading}>
          About this plant
        </Text>
        <ProtoSection>
          <View style={styles.photoRow}>
            {/* The square picks a photo too, as on the Plant screen. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={prepared ? 'Replace photo' : 'Add photo'}
              onPress={photoPicker.choose}
              style={({ pressed }) => pressed && pressedStyle.button}
            >
              <PlantPhoto
                uri={prepared}
                focus={picked?.focus}
                size={64}
                name={nickname || species?.colloquialName || ''}
              />
            </Pressable>
            <TextButton
              label={prepared ? 'Replace photo' : 'Add photo'}
              onPress={photoPicker.choose}
            />
          </View>
          {photoPicker.framing}
          {IDENTIFY_SHOWN && prepared && (
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
            // Blank, the plant goes by its species' name (CONTEXT.md, Display Name), as in Edit plant.
            placeholder={species?.colloquialName ?? (own ? 'Required' : 'Optional')}
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="words"
            // iOS would offer contacts' names.
            textContentType="none"
          />
          {/* PROTOTYPE species B: the reason under what's missing. */}
          {speciesVariant === 'B' && own && !species && !nickname.trim() && (
            <Text style={text.footnote}>Give it a nickname to add it without a species.</Text>
          )}
          <Field
            label="Pot size"
            suffix="cm"
            placeholder="Optional"
            value={potSizeCm}
            onChangeText={setPotSizeCm}
            keyboardType="decimal-pad"
          />
          <Field label="Soil" placeholder="Optional" value={soil} onChangeText={setSoil} />
        </ProtoSection>

        {own && (
          <>
            <Text accessibilityRole="header" style={heading}>
              Care schedule
            </Text>
            {speciesVariant === 'B' &&
              !CARE_TYPES.some((type) => hasOverride(schedule.overrides, type)) && (
                <Text style={text.footnote}>
                  Give it its own schedule for at least one care type.
                </Text>
              )}
            {schedule.fields}
          </>
        )}

        <Text accessibilityRole="header" style={heading}>
          {words === 'A' ? 'When did you last…' : 'Care so far'}
        </Text>
        <ProtoSection>
          <Text lineBreakStrategyIOS="standard" style={text.subheadline}>
            Optional. Answers set the first due dates; the rest count from today.
          </Text>
          {CARE_TYPES.map((type) => (
            <WhenPicker
              key={type}
              label={LAST_DONE_LABEL[words][type]}
              optional
              value={lastDone[type] ?? null}
              onChange={(day) => setLastDone({ ...lastDone, [type]: day ?? undefined })}
            />
          ))}
        </ProtoSection>
      </ScrollView>
      <ProtoPill floating />
    </View>
  );
}

/**
 * Whether New plant offers Identify from photo. Hidden for now at the owner's call (2026-09-27);
 * the relay route and the name index stay, so turning this back on is the whole change.
 */
const IDENTIFY_SHOWN = false;

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
  variant: 'A' | 'B' | 'C',
): string | null {
  if (species) return null;
  if (!ownSchedule) {
    return variant === 'B'
      ? 'Pick a species, or give it its own schedule and a nickname.'
      : 'Pick a species, or add without one and give it a nickname.';
  }
  if (!nickname.trim()) {
    return variant === 'C'
      ? 'Pick a species, or give it a nickname and its own schedule.'
      : 'Give it a nickname to add it without a species.';
  }
  if (schedule.problem) return schedule.problem;
  if (!CARE_TYPES.some((type) => hasOverride(schedule.overrides, type))) {
    return 'Give it its own schedule for at least one care type.';
  }
  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // PROTOTYPE: room at the end for the pill.
  screen: { padding: space.l, gap: space.m, paddingBottom: space.xxxl + 56 },
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
