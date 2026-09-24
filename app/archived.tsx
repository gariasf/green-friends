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
    <ScrollView contentContainerStyle={plants.length === 0 ? styles.empty : styles.list}>
      {plants.length === 0 ? (
        <Text style={text.subheadline}>No archived plants.</Text>
      ) : (
        <View style={group.box}>
          {plants.map((plant, index) => (
            <PlantRow
              key={plant.id}
              photo={plant.photo}
              name={plant.displayName}
              detail={
                plant.archivedAt &&
                `Archived · ${dayLabel(localDay(new Date(plant.archivedAt)), today)}`
              }
              first={index === 0}
              onPress={() => router.push({ pathname: '/plants/[id]', params: { id: plant.id } })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: space.l },
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
});
