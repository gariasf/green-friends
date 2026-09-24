import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { deleteCareEvent, editCareEvent, getCareEvent } from '@/src/core/careLog';
import { db } from '@/src/db/client';
import { CARE_COPY, useCareEventDetails } from '@/src/ui/CareEvent';
import { alertError, PrimaryButton, TextButton } from '@/src/ui/Form';
import { space, text } from '@/src/ui/theme';
import { WhenPicker } from '@/src/ui/WhenPicker';

/**
 * One Care Event from the Care Log, to edit (its day, a Note's text, a repot's pot size and soil)
 * or delete. Due-ness re-derives from whatever the Care Log then holds. PROTOTYPE (UI pass): the
 * day comes from the shared WhenPicker instead of a day-by-day stepper.
 */
export default function CareEventSheet() {
  const { id } = useLocalSearchParams<'/care-events/[id]'>();
  const [event] = useState(() => getCareEvent(db, id));
  const [occurredOn, setOccurredOn] = useState(event.occurredOn);
  const details = useCareEventDetails(event.type, event);
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
      <View style={styles.block}>
        <Text style={styles.label}>When</Text>
        <WhenPicker value={occurredOn} onChange={(day) => day && setOccurredOn(day)} />
      </View>
      {details.fields}
      <PrimaryButton label="Save" disabled={!details.complete} onPress={save} />
      <View style={styles.centered}>
        <TextButton label="Delete from Care Log" destructive onPress={remove} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.l, padding: space.xl, paddingTop: space.xxl },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  block: { gap: space.s },
  label: { ...text.footnote, marginLeft: space.xs },
  centered: { alignItems: 'center' },
});
