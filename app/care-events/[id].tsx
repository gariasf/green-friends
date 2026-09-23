import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteCareEvent, editCareEvent, getCareEvent } from '@/src/core/careLog';
import { localDay, shiftDays } from '@/src/core/dates';
import { db } from '@/src/db/client';
import { CARE_COPY, dayLabel, useCareEventDetails } from '@/src/ui/CareEvent';
import { alertError, PrimaryButton } from '@/src/ui/Form';

/**
 * One Care Event from the Care Log, to edit (its day, a Note's text, a repot's pot size and soil)
 * or delete. Due-ness re-derives from whatever the Care Log then holds.
 */
export default function CareEventSheet() {
  const { id } = useLocalSearchParams<'/care-events/[id]'>();
  const [event] = useState(() => getCareEvent(db, id));
  const [occurredOn, setOccurredOn] = useState(event.occurredOn);
  const details = useCareEventDetails(event.type, event);
  const today = localDay(new Date());
  const copy = CARE_COPY[event.type];

  const save = () => {
    try {
      editCareEvent(db, event.id, { occurredOn, ...details.values });
      router.back();
    } catch (error) {
      alertError('Could not save it', error);
    }
  };

  const remove = () =>
    Alert.alert('Delete from the Care Log?', 'Due dates then count from the rest of the log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCareEvent(db, event.id);
          router.back();
        },
      },
    ]);

  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>
        {copy.icon} {copy.done}
      </Text>
      <Text style={styles.hint}>When did it happen?</Text>
      <View style={styles.stepper}>
        <Step
          label="‹"
          accessibilityLabel="A day earlier"
          onPress={() => setOccurredOn(shiftDays(occurredOn, -1))}
        />
        <Text style={styles.day}>{dayLabel(occurredOn, today)}</Text>
        <Step
          label="›"
          accessibilityLabel="A day later"
          disabled={occurredOn >= today}
          onPress={() => setOccurredOn(shiftDays(occurredOn, 1))}
        />
      </View>
      {details.fields}
      <PrimaryButton label="Save" disabled={!details.complete} onPress={save} />
      <Pressable accessibilityRole="button" hitSlop={8} onPress={remove}>
        <Text style={styles.delete}>Delete</Text>
      </Pressable>
    </View>
  );
}

function Step({
  label,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={[styles.step, disabled && styles.stepDisabled]}
    >
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 12, padding: 20, paddingTop: 28 },
  title: { fontSize: 20, fontWeight: '800' },
  hint: { fontSize: 14, color: '#666' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  day: { fontSize: 17, fontWeight: '600' },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.3 },
  stepText: { fontSize: 22, fontWeight: '600' },
  delete: { fontSize: 16, color: '#e0342b', fontWeight: '600', textAlign: 'center' },
});
