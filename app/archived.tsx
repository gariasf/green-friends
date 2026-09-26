import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { localDay } from '@/src/core/dates';
import { listArchivedPlants } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { dayLabel } from '@/src/ui/words';
import { EmptyState } from '@/src/ui/EmptyState';
import { PlantRow } from '@/src/ui/PlantRow';
import { group, space } from '@/src/ui/theme';
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
    <ScrollView contentContainerStyle={styles.list}>
      {plants.length === 0 ? (
        <EmptyState
          symbol="archive"
          title="No archived plants"
          line="A plant archived from Edit keeps its Care Log and photo here."
        />
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
});
