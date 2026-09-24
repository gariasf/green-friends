import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteCareEvent, editCareEvent, getCareEvent } from '@/src/core/careLog';
import { localDay, shiftDays } from '@/src/core/dates';
import { db } from '@/src/db/client';
import { CARE_COPY, dayLabel, useCareEventDetails } from '@/src/ui/CareEvent';
import { alertError, PrimaryButton, TextButton } from '@/src/ui/Form';
import { colors, space, text } from '@/src/ui/theme';

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
      <View style={styles.title}>
        <SymbolView name={copy.symbol} size={22} tintColor={copy.hue} />
        <Text style={text.title3}>{copy.done}</Text>
      </View>
      <Text style={text.subheadline}>When did it happen?</Text>
      <View style={styles.stepper}>
        <Step
          symbol="chevron.left"
          accessibilityLabel="A day earlier"
          onPress={() => setOccurredOn(shiftDays(occurredOn, -1))}
        />
        <Text style={text.headline}>{dayLabel(occurredOn, today)}</Text>
        <Step
          symbol="chevron.right"
          accessibilityLabel="A day later"
          disabled={occurredOn >= today}
          onPress={() => setOccurredOn(shiftDays(occurredOn, 1))}
        />
      </View>
      {details.fields}
      <PrimaryButton label="Save" disabled={!details.complete} onPress={save} />
      <TextButton label="Delete" destructive onPress={remove} style={styles.delete} />
    </View>
  );
}

function Step({
  symbol,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  symbol: SFSymbol;
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
      // 40 pt across; this makes it a 48 pt target.
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        pressed && styles.stepPressed,
        disabled && styles.stepDisabled,
      ]}
    >
      <SymbolView name={symbol} size={18} weight="semibold" tintColor={colors.tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.m, padding: space.xl, paddingTop: space.xxl },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  stepPressed: { opacity: 0.5 },
  stepDisabled: { opacity: 0.3 },
  delete: { alignSelf: 'center' },
});
