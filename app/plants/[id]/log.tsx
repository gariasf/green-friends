import { SegmentedControl } from '@expo/ui/community/segmented-control';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dueCare, evaluateCare } from '@/src/core/care';
import { CARE_EVENT_TYPES, logCareEvent, type CareEventType } from '@/src/core/careLog';
import { localDay } from '@/src/core/dates';
import { getDisplayName } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, useCareEventDetails } from '@/src/ui/CareEvent';
import { alertError, CloseButton, PrimaryButton, WhenPicker } from '@/src/ui/Form';
import { space, text } from '@/src/ui/theme';

/**
 * The log sheet (spec #22): logs any care type or a Note on any day up to today, a repot with its
 * new pot and soil. Opens preset to the care type in its `type` param, else the first one Due. An
 * Archived plant is out of care, so for one it only adds a Note.
 */
export default function LogCareSheet() {
  const { id, type: preset } = useLocalSearchParams<'/plants/[id]/log', { type?: string }>();
  const [displayName] = useState(() => getDisplayName(db, id));
  // ponytail: evaluates the whole garden to find one plant; fine at dozens of plants, a core read
  // of one plant by id at hundreds.
  const [inCare] = useState(() => evaluateCare(db).find((candidate) => candidate.id === id));
  const [type, setType] = useState<CareEventType>(() =>
    inCare
      ? (CARE_EVENT_TYPES.find((option) => option === preset) ??
        dueCare(inCare)[0]?.type ??
        'water')
      : 'note',
  );
  const [day, setDay] = useState(() => localDay(new Date()));
  const details = useCareEventDetails(type);

  const log = () => {
    try {
      logCareEvent(db, { plantId: id, type, occurredOn: day, ...details.values });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      alertError('Could not log it', error);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={text.footnote}>{displayName}</Text>
          <Text style={text.title3}>Log care</Text>
        </View>
        <CloseButton />
      </View>
      {inCare && (
        <SegmentedControl
          values={CARE_EVENT_TYPES.map((option) => CARE_COPY[option].label)}
          selectedIndex={CARE_EVENT_TYPES.indexOf(type)}
          onChange={({ nativeEvent }) => {
            Haptics.selectionAsync();
            setType(CARE_EVENT_TYPES[nativeEvent.selectedSegmentIndex]);
          }}
        />
      )}
      <WhenPicker label="When did it happen?" value={day} onChange={setDay} />
      {details.fields}
      <PrimaryButton
        label={type === 'note' ? 'Add note' : `Mark as ${CARE_COPY[type].done.toLowerCase()}`}
        disabled={!details.complete}
        onPress={log}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.l, padding: space.xl, paddingTop: space.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.m },
  grow: { flex: 1 },
});
