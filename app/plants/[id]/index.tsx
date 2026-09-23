import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dueCare, evaluateCare } from '@/src/core/care';
import { CARE_EVENT_TYPES, logCareEvent, type CareEventType } from '@/src/core/careLog';
import { localDay, shiftDays } from '@/src/core/dates';
import { db } from '@/src/db/client';
import { CARE_COPY, useCareEventDetails } from '@/src/ui/CareEvent';
import { ChipGroup } from '@/src/ui/Chip';
import { alertError, PrimaryButton } from '@/src/ui/Form';

const KINDS = CARE_EVENT_TYPES.map((type) => ({
  label: `${CARE_COPY[type].icon} ${CARE_COPY[type].label}`,
  value: type,
}));

/** Backdating quick options (spec #8), in days ago. */
const WHEN = [
  { label: 'Today', value: 0 },
  { label: 'Yesterday', value: 1 },
  { label: '2 days ago', value: 2 },
  { label: '3 days ago', value: 3 },
];

/**
 * The plant sheet (spec #8, prototype #6): logs any care type or a Note on a day up to three days
 * back, a repot with its new pot and soil, and leads to the plant's Care Log.
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
  const details = useCareEventDetails(type);
  // Only a plant in care, live and not Archived, has a sheet.
  if (!plant) return null;

  const log = () => {
    try {
      logCareEvent(db, {
        plantId: plant.id,
        type,
        occurredOn: shiftDays(localDay(new Date()), -daysAgo),
        ...details.values,
      });
      router.back();
    } catch (error) {
      alertError('Could not log it', error);
    }
  };

  return (
    <View style={styles.sheet}>
      <View>
        <Text style={styles.name}>{plant.displayName}</Text>
        {plant.scientificName && <Text style={styles.scientific}>{plant.scientificName}</Text>}
      </View>
      <ChipGroup options={KINDS} value={type} onChange={setType} />
      <Text style={styles.hint}>When did it happen?</Text>
      <ChipGroup options={WHEN} value={daysAgo} onChange={setDaysAgo} />
      {details.fields}
      <PrimaryButton
        label={type === 'note' ? 'Add note' : `Log ${CARE_COPY[type].label.toLowerCase()}`}
        disabled={!details.complete}
        onPress={log}
      />
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        // Replace, not push: a screen pushed from a sheet would land beneath it.
        onPress={() => router.replace({ pathname: '/plants/[id]/log', params: { id: plant.id } })}
      >
        <Text style={styles.link}>Care Log ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 12, padding: 20, paddingTop: 28 },
  name: { fontSize: 20, fontWeight: '800' },
  scientific: { fontSize: 14, fontStyle: 'italic', color: '#666' },
  hint: { fontSize: 14, color: '#666' },
  link: { fontSize: 16, color: '#2e7d32', fontWeight: '600', textAlign: 'center' },
});
