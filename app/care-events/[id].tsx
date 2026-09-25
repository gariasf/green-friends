import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { deleteCareEvent, editCareEvent, getCareEvent } from '@/src/core/careLog';
import { db } from '@/src/db/client';
import { CARE_COPY, CareSymbol, useCareEventDetails } from '@/src/ui/CareEvent';
import { alertError, CloseButton, PrimaryButton, TextButton, WhenPicker } from '@/src/ui/Form';
import { space, text } from '@/src/ui/theme';

/**
 * One Care Event from the Care Log, to edit (its day, a Note's text, a repot's pot size and soil)
 * or delete. Due-ness re-derives from whatever the Care Log then holds.
 */
export default function CareEventSheet() {
  const { id } = useLocalSearchParams<'/care-events/[id]'>();
  const [event] = useState(() => getCareEvent(db, id));
  const [occurredOn, setOccurredOn] = useState(event.occurredOn);
  const details = useCareEventDetails(event.type, event);

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
      <View style={styles.header}>
        <CareSymbol type={event.type} size={22} />
        <Text accessibilityRole="header" style={[text.title3, styles.grow]}>
          {CARE_COPY[event.type].done}
        </Text>
        <CloseButton />
      </View>
      <WhenPicker label="When did it happen?" value={occurredOn} onChange={setOccurredOn} />
      {details.fields}
      <PrimaryButton label="Save" disabled={!details.complete} onPress={save} />
      <TextButton label="Delete" destructive onPress={remove} style={styles.delete} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.l, padding: space.xl, paddingTop: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  grow: { flex: 1 },
  delete: { alignSelf: 'center' },
});
