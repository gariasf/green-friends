import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dueCare, evaluateCare } from '@/src/core/care';
import { CARE_EVENT_TYPES, logCareEvent, type CareEventType } from '@/src/core/careLog';
import { localDay, shiftDays } from '@/src/core/dates';
import { setPlantPhoto } from '@/src/core/photos';
import { db } from '@/src/db/client';
import { CARE_COPY, useCareEventDetails } from '@/src/ui/CareEvent';
import { ChipGroup } from '@/src/ui/Chip';
import { alertError, PrimaryButton, TextButton } from '@/src/ui/Form';
import { PhotoButton, PlantPhoto, photoFiles, photoUri } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/PlantRow';
import { colors, space, text } from '@/src/ui/theme';

const KINDS = CARE_EVENT_TYPES.map((type) => ({ label: CARE_COPY[type].label, value: type }));

/** Backdating quick options (spec #8), in days ago. */
const WHEN = [
  { label: 'Today', value: 0 },
  { label: 'Yesterday', value: 1 },
  { label: '2 days ago', value: 2 },
  { label: '3 days ago', value: 3 },
];

/**
 * The plant sheet (spec #8, prototype #6): logs any care type or a Note on a day up to three days
 * back, a repot with its new pot and soil, adds or replaces the plant's photo, and leads to the
 * plant's Care Log and its details.
 */
export default function PlantSheet() {
  const { id } = useLocalSearchParams<'/plants/[id]'>();
  // ponytail: evaluates the whole garden to find one plant; fine at dozens of plants.
  const [plant] = useState(() => evaluateCare(db).find((candidate) => candidate.id === id));
  // Opened from a Today card, the sheet is most likely there to backdate the care it shows Due.
  const [type, setType] = useState<CareEventType>(
    () => (plant && dueCare(plant)[0]?.type) ?? 'water',
  );
  const [daysAgo, setDaysAgo] = useState(0);
  const [photo, setPhoto] = useState(() => plant?.photo ?? null);
  const details = useCareEventDetails(type);
  // Only a plant in care, live and not Archived, has a sheet.
  if (!plant) return null;
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);

  const log = () => {
    try {
      logCareEvent(db, {
        plantId: plant.id,
        type,
        occurredOn: shiftDays(localDay(new Date()), -daysAgo),
        ...details.values,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      alertError('Could not log it', error);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <PlantPhoto uri={photoUri(photo)} size={64} />
        <View style={styles.grow}>
          <Text style={text.title3}>{plant.displayName}</Text>
          {scientific && <Text style={styles.scientific}>{scientific}</Text>}
          {plant.toxicToPets !== null && (
            <Text style={plant.toxicToPets ? styles.toxic : text.subheadline}>
              {plant.toxicToPets ? 'Toxic to pets' : 'Non-toxic to pets'}
            </Text>
          )}
          <PhotoButton
            hasPhoto={photo !== null}
            onPick={(prepared) =>
              setPhoto(setPlantPhoto(db, photoFiles, plant.id, prepared).filename)
            }
          />
        </View>
      </View>
      <ChipGroup options={KINDS} value={type} onChange={setType} />
      <Text style={text.subheadline}>When did it happen?</Text>
      <ChipGroup options={WHEN} value={daysAgo} onChange={setDaysAgo} />
      {details.fields}
      <PrimaryButton
        label={type === 'note' ? 'Add note' : `Log ${CARE_COPY[type].label.toLowerCase()}`}
        disabled={!details.complete}
        onPress={log}
      />
      {/* Replace, not push: a screen pushed from a sheet would land beneath it. */}
      <View style={styles.links}>
        <TextButton
          label="Care Log"
          onPress={() => router.replace({ pathname: '/plants/[id]/log', params: { id: plant.id } })}
        />
        <TextButton
          label="Edit plant"
          onPress={() =>
            router.replace({ pathname: '/plants/[id]/edit', params: { id: plant.id } })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.m, padding: space.xl, paddingTop: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  grow: { flex: 1, gap: space.xs },
  scientific: { ...text.subheadline, fontStyle: 'italic' },
  toxic: { ...text.subheadline, fontWeight: '600', color: colors.danger },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.xxxl, marginTop: space.s },
});
