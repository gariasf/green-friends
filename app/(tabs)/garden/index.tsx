import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { listArchivedPlants, listPlants } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { EmptyState } from '@/src/ui/EmptyState';
import { TextButton } from '@/src/ui/Form';
import { PlantRow, scientificBeneath } from '@/src/ui/PlantRow';
import { group, space } from '@/src/ui/theme';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

const ADD_PLANT = { label: 'Add a plant', onPress: () => router.push('/plants/new') };

function readGarden() {
  return { plants: listPlants(db), archivedCount: listArchivedPlants(db).length };
}

/**
 * Garden: every live plant by Display Name, with its photo, each opening its Plant screen; Archived
 * plants have a view of their own. Read again after writes: a photo is a row of its own, which a
 * live query over plants would miss.
 */
export default function GardenScreen() {
  const [{ plants, archivedCount }, setGarden] = useState(readGarden);
  useAfterWrites(useCallback(() => setGarden(readGarden()), []));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.list}>
      {plants.length === 0 ? (
        archivedCount > 0 ? (
          <EmptyState
            symbol="archivebox"
            title="No plants in care"
            line="Every plant is Archived. Unarchive one below, or add a new one."
            action={ADD_PLANT}
          />
        ) : (
          <EmptyState
            symbol="leaf"
            title="No plants yet"
            line="Add your first plant to start its Care Log."
            action={ADD_PLANT}
          />
        )
      ) : (
        <View style={group.box}>
          {plants.map((plant, index) => (
            <PlantRow
              key={plant.id}
              photo={plant.photo}
              name={plant.displayName}
              detail={scientificBeneath(plant.displayName, plant.scientificName)}
              first={index === 0}
              onPress={() => router.push({ pathname: '/plants/[id]', params: { id: plant.id } })}
            />
          ))}
        </View>
      )}
      {archivedCount > 0 && (
        <TextButton
          label={`Archived · ${archivedCount}`}
          onPress={() => router.push('/archived')}
          style={styles.footer}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: space.l },
  footer: { alignSelf: 'center', marginTop: space.xl },
});
