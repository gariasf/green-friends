import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  archivePlant,
  CARE_TYPES,
  deletePlant,
  getDisplayName,
  getPlant,
  hasOverride,
  SEASONAL,
  unarchivePlant,
  updatePlant,
  type CareSchedule,
  type CareType,
  type PlantPatch,
} from '@/src/core/plants';
import { getSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { CARE_COPY, describeSchedule } from '@/src/ui/CareEvent';
import { ChipGroup } from '@/src/ui/Chip';
import { alertError, Field, optionalNumber, PrimaryButton } from '@/src/ui/Form';
import { photoFiles } from '@/src/ui/Photo';
import { colors, space, text } from '@/src/ui/theme';

/**
 * One care type's schedule as the form holds it: an Override while `own`, else the Species
 * default. `growing` is the Growing interval, or repotting's only one, in months (ADR-0003).
 */
type CareTypeForm = { own: boolean; growing: string; dormant: string };

/**
 * A plant's details (spec #8): its nickname and Current Pot, per care type the Species default or
 * an Override that shadows it (ADR-0003), and Archive, Unarchive or Delete.
 */
export default function EditPlantScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]/edit'>();
  const [plant] = useState(() => getPlant(db, id));
  const [displayName] = useState(() => getDisplayName(db, id));
  const [defaults] = useState(() => (plant.speciesId ? getSpecies(db, plant.speciesId) : null));
  const [nickname, setNickname] = useState(plant.nickname ?? '');
  const [potSizeCm, setPotSizeCm] = useState(plant.potSizeCm?.toString() ?? '');
  const [soil, setSoil] = useState(plant.soil ?? '');
  const [schedule, setSchedule] = useState(() => startingSchedule(plant, defaults));

  const save = () => {
    // A blank Growing interval would clear the Override (ADR-0003), not keep an own schedule.
    const blank = CARE_TYPES.find((type) => schedule[type].own && !schedule[type].growing.trim());
    if (blank) {
      const fallback = defaults ? 'Species default' : 'None';
      alertError(
        'Could not save the plant',
        new Error(`${CARE_COPY[blank].label}: enter how often, or pick ${fallback}.`),
      );
      return;
    }
    const patch: PlantPatch = { nickname, potSizeCm: optionalNumber(potSizeCm), soil };
    for (const type of ['water', 'fertilize'] as const) {
      const { own, growing, dormant } = schedule[type];
      patch[SEASONAL[type].growing] = own ? optionalNumber(growing) : null;
      patch[SEASONAL[type].dormant] = own ? optionalNumber(dormant) : null;
    }
    patch.repottingMonths = schedule.repot.own ? optionalNumber(schedule.repot.growing) : null;
    try {
      updatePlant(db, plant.id, patch);
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
      <Text style={styles.heading}>About this plant</Text>
      <Text style={styles.hint}>Nickname</Text>
      <Field
        // Blank, the plant goes by its species' name (CONTEXT.md, Display Name).
        placeholder={defaults?.colloquialName ?? 'Required without a known species'}
        value={nickname}
        onChangeText={setNickname}
        accessibilityLabel="Nickname"
      />
      <Text style={styles.hint}>Pot size, cm</Text>
      <Field
        placeholder="Optional"
        value={potSizeCm}
        onChangeText={setPotSizeCm}
        keyboardType="decimal-pad"
        accessibilityLabel="Pot size, cm"
      />
      <Text style={styles.hint}>Soil</Text>
      <Field placeholder="Optional" value={soil} onChangeText={setSoil} accessibilityLabel="Soil" />

      <Text style={styles.heading}>Care schedule</Text>
      {CARE_TYPES.map((type) => (
        <CareTypeSchedule
          key={type}
          type={type}
          value={schedule[type]}
          defaults={defaults}
          onChange={(value) => setSchedule((form) => ({ ...form, [type]: value }))}
        />
      ))}

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
        <Pressable accessibilityRole="button" hitSlop={8} onPress={remove}>
          <Text style={styles.delete}>Delete plant</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function CareTypeSchedule({
  type,
  value,
  defaults,
  onChange,
}: {
  type: CareType;
  value: CareTypeForm;
  defaults: CareSchedule | null;
  onChange: (value: CareTypeForm) => void;
}) {
  return (
    <View style={styles.careType}>
      <View style={styles.careTypeHead}>
        <SymbolView name={CARE_COPY[type].symbol} size={18} tintColor={CARE_COPY[type].hue} />
        <Text style={styles.label}>{CARE_COPY[type].label}</Text>
      </View>
      <ChipGroup
        options={[
          { label: defaults ? 'Species default' : 'None', value: false },
          { label: 'Own schedule', value: true },
        ]}
        value={value.own}
        onChange={(own) => onChange({ ...value, own })}
      />
      {!value.own && <Text style={styles.hint}>{describeSchedule(type, defaults)}.</Text>}
      {value.own && (
        <>
          <Text style={styles.hint}>
            {type === 'repot' ? 'Every … months' : 'Growing season: every … days'}
          </Text>
          <Field
            value={value.growing}
            onChangeText={(growing) => onChange({ ...value, growing })}
            keyboardType="number-pad"
            accessibilityLabel={`${CARE_COPY[type].label}, ${type === 'repot' ? 'months' : 'Growing season, days'}`}
          />
          {type !== 'repot' && (
            <>
              <Text style={styles.hint}>Dormant season: every … days; blank pauses it</Text>
              <Field
                value={value.dormant}
                onChangeText={(dormant) => onChange({ ...value, dormant })}
                keyboardType="number-pad"
                accessibilityLabel={`${CARE_COPY[type].label}, Dormant season, days`}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

function Action({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityHint={hint} hitSlop={8} onPress={onPress}>
      <Text style={styles.link}>{label}</Text>
      <Text style={[styles.hint, styles.centered]}>{hint}</Text>
    </Pressable>
  );
}

/**
 * Where the form starts: each care type's Override where one is set, else the Species default, so
 * an Override begins from the values it shadows.
 */
function startingSchedule(
  plant: CareSchedule,
  defaults: CareSchedule | null,
): Record<CareType, CareTypeForm> {
  const text = (value: number | null | undefined) => value?.toString() ?? '';
  const seasonal = (type: 'water' | 'fertilize'): CareTypeForm => {
    const { growing, dormant } = SEASONAL[type];
    const own = hasOverride(plant, type);
    const source = own ? plant : defaults;
    return { own, growing: text(source?.[growing]), dormant: text(source?.[dormant]) };
  };
  const ownRepot = hasOverride(plant, 'repot');
  return {
    water: seasonal('water'),
    fertilize: seasonal('fertilize'),
    repot: {
      own: ownRepot,
      growing: text((ownRepot ? plant : defaults)?.repottingMonths),
      dormant: '',
    },
  };
}

const styles = StyleSheet.create({
  screen: { padding: space.l, gap: space.m, paddingBottom: 48 },
  heading: { ...text.title3, marginTop: space.s },
  label: { ...text.callout, fontWeight: '600' },
  hint: { ...text.subheadline },
  centered: { textAlign: 'center' },
  careType: { gap: space.s },
  careTypeHead: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  link: { fontSize: 16, color: colors.tint, fontWeight: '600', textAlign: 'center' },
  actions: { marginTop: space.xxl, gap: space.xxl },
  delete: { fontSize: 16, color: colors.destructive, fontWeight: '600', textAlign: 'center' },
});
