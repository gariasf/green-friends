import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { localDay } from '@/src/core/dates';
import { listArchivedPlants } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { dayLabel } from '@/src/ui/CareEvent';
import { PlantRow } from '@/src/ui/PlantRow';
import { group, space, text } from '@/src/ui/theme';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

/**
 * Archived plants (CONTEXT.md): out of care, their Care Log and photo kept. Each opens its Plant
 * screen, where it can be unarchived.
 */
export default function ArchivedScreen() {
  const [plants, setPlants] = useState(() => listArchivedPlants(db));
  useAfterWrites(useCallback(() => setPlants(listArchivedPlants(db)), []));
  const today = localDay(new Date());

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {plants.length === 0 ? (
        <Text style={[text.subheadline, styles.empty]}>No archived plants.</Text>
      ) : (
        <View style={group.box}>
          {plants.map((item, index) => (
            <PlantRow
              key={item.id}
              first={index === 0}
              photo={item.photo}
              name={item.displayName}
              detail={
                item.archivedAt &&
                `Archived ${dayLabel(localDay(new Date(item.archivedAt)), today).toLowerCase()}`
              }
              onPress={() => router.push({ pathname: '/plants/[id]', params: { id: item.id } })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.l, paddingBottom: 64 },
  empty: { textAlign: 'center', padding: space.xxxl },
});
