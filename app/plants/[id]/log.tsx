import { SegmentedControl } from '@expo/ui/community/segmented-control';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CARE_EVENT_TYPES, logCareEvent, type CareEventType } from '@/src/core/careLog';
import { localDay } from '@/src/core/dates';
import { getDisplayName } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, useCareEventDetails } from '@/src/ui/CareEvent';
import { alertError, PrimaryButton } from '@/src/ui/Form';
import { colors, space, text } from '@/src/ui/theme';
import { WhenPicker } from '@/src/ui/WhenPicker';

const SAVE: Record<CareEventType, string> = {
  water: 'Mark as watered',
  fertilize: 'Mark as fertilized',
  repot: 'Mark as repotted',
  note: 'Add note',
};

/**
 * PROTOTYPE (UI pass): logging care on any day, as a sheet over the plant or Today: which care
 * (a segmented control), when (Today, Yesterday or any earlier day), and what a Note or a repot
 * records. Opened preset to the care type it was asked for.
 */
export default function LogCareSheet() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const id = params.id;
  const [name] = useState(() => getDisplayName(db, id));
  const [type, setType] = useState<CareEventType>(() =>
    CARE_EVENT_TYPES.includes(params.type as CareEventType)
      ? (params.type as CareEventType)
      : 'water',
  );
  const [day, setDay] = useState(() => localDay(new Date()));
  const details = useCareEventDetails(type);

  const save = () => {
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
          <Text style={text.footnote}>{name}</Text>
          <Text style={text.title3}>Log care</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={() => router.back()}
        >
          <SymbolView name="xmark.circle.fill" size={30} tintColor={colors.tertiaryLabel} />
        </Pressable>
      </View>
      <SegmentedControl
        values={CARE_EVENT_TYPES.map((option) => CARE_COPY[option].label)}
        selectedIndex={CARE_EVENT_TYPES.indexOf(type)}
        onChange={({ nativeEvent }) => {
          Haptics.selectionAsync();
          setType(CARE_EVENT_TYPES[nativeEvent.selectedSegmentIndex]);
        }}
      />
      <View style={styles.block}>
        <Text style={styles.label}>When</Text>
        <WhenPicker value={day} onChange={(picked) => picked && setDay(picked)} />
      </View>
      {details.fields}
      <PrimaryButton label={SAVE[type]} disabled={!details.complete} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.l, padding: space.xl, paddingTop: space.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.m },
  grow: { flex: 1 },
  block: { gap: space.s },
  label: { ...text.footnote, marginLeft: space.xs },
});
