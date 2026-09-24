import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { listArchivedPlants, listPlants } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { TextButton } from '@/src/ui/Form';
import { PlantRow, scientificBeneath } from '@/src/ui/PlantRow';
import { group, space, text } from '@/src/ui/theme';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={plants.length === 0 ? styles.empty : styles.list}
    >
      {plants.length === 0 ? (
        <>
          <Text style={text.title2}>
            {archivedCount > 0 ? 'No plants in care' : 'No plants yet'}
          </Text>
          <Text style={text.subheadline}>
            {archivedCount > 0
              ? 'Tap + to add one, or unarchive one below.'
              : 'Tap + to add your first plant.'}
          </Text>
        </>
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
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
    gap: space.s,
  },
  footer: { alignSelf: 'center', marginTop: space.xl },
});
