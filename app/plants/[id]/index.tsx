import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { dueCare, evaluateCare } from '@/src/core/care';
import { CARE_EVENT_TYPES, logCareEvent, type CareEventType } from '@/src/core/careLog';
import { localDay, shiftDays } from '@/src/core/dates';
import { db } from '@/src/db/client';
import { CARE_COPY } from '@/src/ui/care';
import { ChipGroup } from '@/src/ui/Chip';
import { Field, optionalNumber, PrimaryButton } from '@/src/ui/Form';

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
  const [plant] = useState(() => evaluateCare(db).find((candidate) => candidate.id === id));
  // Opened from a Today card, the sheet is most likely there to backdate the care it shows Due.
  const [type, setType] = useState<CareEventType>(
    () => (plant && dueCare(plant)[0]?.type) ?? 'water',
  );
  const [daysAgo, setDaysAgo] = useState(0);
  const [note, setNote] = useState('');
  const [potSizeCm, setPotSizeCm] = useState('');
  const [soil, setSoil] = useState('');
  if (!plant) return null;

  const log = () => {
    try {
      logCareEvent(db, {
        plantId: plant.id,
        type,
        occurredOn: shiftDays(localDay(new Date()), -daysAgo),
        note: type === 'note' ? note : null,
        potSizeCm: type === 'repot' ? optionalNumber(potSizeCm) : null,
        soil: type === 'repot' ? soil : null,
      });
      router.back();
    } catch (error) {
      Alert.alert('Could not log it', error instanceof Error ? error.message : String(error));
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
      {type === 'note' && (
        <Field
          placeholder="What did you notice? Pests, a new leaf…"
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
        />
      )}
      {type === 'repot' && (
        <>
          <Field
            placeholder="New pot size in cm (optional)"
            value={potSizeCm}
            onChangeText={setPotSizeCm}
            keyboardType="decimal-pad"
          />
          <Field placeholder="Soil (optional)" value={soil} onChangeText={setSoil} />
        </>
      )}
      <PrimaryButton
        label={type === 'note' ? 'Add note' : `Log ${CARE_COPY[type].label.toLowerCase()}`}
        disabled={type === 'note' && note.trim() === ''}
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
