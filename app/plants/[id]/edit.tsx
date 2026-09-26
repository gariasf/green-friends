import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  archivePlant,
  deletePlant,
  getDisplayName,
  getPlant,
  unarchivePlant,
  updatePlant,
} from '@/src/core/plants';
import { getSpecies, type Species } from '@/src/core/species';
import { db } from '@/src/db/client';
import { useCareSchedule } from '@/src/ui/CareSchedule';
import { alertError, Field, optionalNumber, PrimaryButton, TextButton } from '@/src/ui/Form';
import { photoFiles } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/words';
import { PickedSpecies, SpeciesSearch } from '@/src/ui/SpeciesPicker';
import { colors, group, pressedStyle, space, text } from '@/src/ui/theme';

/**
 * A plant's details (spec #8): its Species, which a plant without one can gain (#31), its nickname
 * and Current Pot, per care type the Species default or an Override that shadows it (ADR-0003),
 * and Archive, Unarchive or Delete. Overrides stay through a change of Species.
 */
export default function EditPlantScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]/edit'>();
  const [plant] = useState(() => getPlant(db, id));
  const [displayName] = useState(() => getDisplayName(db, id));
  /** The plant's Species as the catalog knows it: null without one, or for an imported unknown one. */
  const [species, setSpecies] = useState<Species | null>(() =>
    plant.speciesId ? getSpecies(db, plant.speciesId) : null,
  );
  const [searching, setSearching] = useState(false);
  const [nickname, setNickname] = useState(plant.nickname ?? '');
  const [potSizeCm, setPotSizeCm] = useState(plant.potSizeCm?.toString() ?? '');
  const [soil, setSoil] = useState(plant.soil ?? '');
  const schedule = useCareSchedule(plant, species);

  const save = () => {
    if (schedule.problem) {
      alertError('Could not save the plant', new Error(schedule.problem));
      return;
    }
    try {
      updatePlant(db, plant.id, {
        speciesId: species?.id,
        nickname,
        potSizeCm: optionalNumber(potSizeCm),
        soil,
        ...schedule.overrides,
      });
      router.back();
    } catch (error) {
      alertError('Could not save the plant', error);
    }
  };

  const remove = () =>
    Alert.alert(
      `Delete ${displayName}?`,
      'Its Care Log and photo go with it. For a plant that died or was given away, Archive keeps its history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePlant(db, photoFiles, plant.id);
            // Back to what opened Edit; a Plant screen there closes itself once its plant is gone.
            router.back();
          },
        },
      ],
    );

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: displayName }} />
      <Text accessibilityRole="header" style={styles.heading}>
        Species
      </Text>
      {searching ? (
        <SpeciesSearch
          onPick={(picked) => {
            setSpecies(picked);
            setSearching(false);
          }}
          fallback={{
            label: species
              ? `Keep ${species.colloquialName}`
              : plant.speciesId
                ? 'Keep its species'
                : 'Keep it without a species',
            line: 'Check the spelling, or search by its scientific name.',
            onPress: () => setSearching(false),
          }}
        />
      ) : species ? (
        <PickedSpecies
          title={species.colloquialName}
          subtitle={scientificBeneath(species.colloquialName, species.scientificName)}
          action="Change"
          onAction={() => setSearching(true)}
        />
      ) : plant.speciesId ? (
        <PickedSpecies
          title="Not in the catalog"
          subtitle="Its species came with an Import from a newer catalog."
          action="Change"
          onAction={() => setSearching(true)}
        />
      ) : (
        <PickedSpecies
          title="No species"
          subtitle="This plant carries its own care schedule."
          action="Pick a species"
          onAction={() => setSearching(true)}
        />
      )}

      <Text accessibilityRole="header" style={styles.heading}>
        About this plant
      </Text>
      <Field
        label="Nickname"
        // Blank, the plant goes by its species' name (CONTEXT.md, Display Name).
        placeholder={species?.colloquialName ?? 'Required without a known species'}
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

      <Text accessibilityRole="header" style={styles.heading}>
        Care schedule
      </Text>
      {schedule.fields}

      <PrimaryButton label="Save" onPress={save} />

      <View style={styles.actions}>
        {plant.archivedAt ? (
          <Action
            label="Unarchive"
            hint="Back in care, Due as its Care Log says."
            onPress={() => {
              unarchivePlant(db, plant.id);
              router.back();
            }}
          />
        ) : (
          <Action
            label="Archive"
            hint="Died or given away: it moves to Archived, its Care Log and photo kept."
            onPress={() => {
              archivePlant(db, plant.id);
              router.back();
            }}
          />
        )}
        <TextButton label="Delete plant" destructive onPress={remove} style={styles.centered} />
      </View>
    </ScrollView>
  );
}

function Action({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && pressedStyle.button]}
    >
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={[text.subheadline, styles.centeredText]}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.l, gap: space.m, paddingBottom: space.xxxl },
  heading: { ...group.header, marginTop: space.s },
  centered: { alignSelf: 'center' },
  centeredText: { textAlign: 'center' },
  actions: { marginTop: space.xxl, gap: space.xxl },
  action: { alignItems: 'center', gap: space.xs, paddingVertical: space.s },
  actionLabel: { ...text.body, color: colors.tint },
});
