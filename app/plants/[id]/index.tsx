import { SegmentedControl } from '@expo/ui/community/segmented-control';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dueCare, evaluateCare } from '@/src/core/care';
import { CARE_EVENT_TYPES, logCareEvent, type CareEventType } from '@/src/core/careLog';
import { localDay } from '@/src/core/dates';
import { setPlantPhoto } from '@/src/core/photos';
import { db } from '@/src/db/client';
import { CARE_COPY, useCareEventDetails } from '@/src/ui/CareEvent';
import { alertError, CloseButton, PrimaryButton, TextButton, WhenPicker } from '@/src/ui/Form';
import { PhotoButton, photoFiles } from '@/src/ui/Photo';
import { colors, space, text } from '@/src/ui/theme';

/**
 * The log sheet (spec #22): logs any care type or a Note on any day up to today, a repot with its
 * new pot and soil. Opens preset to the care type in its `type` param, else the first one Due. Until
 * the Plant screen (#25), it's also where a plant's toxicity, photo, Care Log and details are
 * reached.
 */
export default function LogCareSheet() {
  const { id, type: preset } = useLocalSearchParams<'/plants/[id]', { type?: string }>();
  // ponytail: evaluates the whole garden to find one plant; fine at dozens of plants.
  const [plant] = useState(() => evaluateCare(db).find((candidate) => candidate.id === id));
  const [type, setType] = useState<CareEventType>(
    () =>
      CARE_EVENT_TYPES.find((option) => option === preset) ??
      (plant && dueCare(plant)[0]?.type) ??
      'water',
  );
  const [day, setDay] = useState(() => localDay(new Date()));
  const [photo, setPhoto] = useState(() => plant?.photo ?? null);
  const details = useCareEventDetails(type);
  // Only a plant in care, live and not Archived, has a sheet.
  if (!plant) return null;

  const log = () => {
    try {
      logCareEvent(db, { plantId: plant.id, type, occurredOn: day, ...details.values });
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
          <Text style={text.footnote}>
            {plant.displayName}
            {plant.toxicToPets !== null && (
              <Text style={plant.toxicToPets && styles.toxic}>
                {plant.toxicToPets ? ' · Toxic to pets' : ' · Non-toxic to pets'}
              </Text>
            )}
          </Text>
          <Text style={text.title3}>Log care</Text>
        </View>
        <CloseButton />
      </View>
      <SegmentedControl
        values={CARE_EVENT_TYPES.map((option) => CARE_COPY[option].label)}
        selectedIndex={CARE_EVENT_TYPES.indexOf(type)}
        onChange={({ nativeEvent }) => {
          Haptics.selectionAsync();
          setType(CARE_EVENT_TYPES[nativeEvent.selectedSegmentIndex]);
        }}
      />
      <WhenPicker label="When did it happen?" value={day} onChange={setDay} />
      {details.fields}
      <PrimaryButton
        label={type === 'note' ? 'Add note' : `Mark as ${CARE_COPY[type].done.toLowerCase()}`}
        disabled={!details.complete}
        onPress={log}
      />
      {/* Replace, not push: a screen pushed from a sheet would land beneath it. */}
      <View style={styles.links}>
        <PhotoButton
          hasPhoto={photo !== null}
          onPick={(prepared) =>
            setPhoto(setPlantPhoto(db, photoFiles, plant.id, prepared).filename)
          }
        />
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
  sheet: { gap: space.l, padding: space.xl, paddingTop: space.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.m },
  grow: { flex: 1 },
  toxic: { fontWeight: '600', color: colors.danger },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    // Apart by their hitSlop and more, however they wrap.
    gap: space.xxl,
  },
});
