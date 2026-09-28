import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { listArchivedPlants, listPlants } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { EmptyState } from '@/src/ui/EmptyState';
import { TextButton } from '@/src/ui/Form';
import { PressSink } from '@/src/ui/motion';
import { PlantPhoto, photoUri } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/words';
import { accessibilitySize, font, radius, space, text } from '@/src/ui/theme';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

const ADD_PLANT = { label: 'Add a plant', onPress: () => router.push('/plants/new') };

function readGarden() {
  return { plants: listPlants(db), archivedCount: listArchivedPlants(db).length };
}

/**
 * Garden: every live plant by Display Name as a grid of photos (spec #61), two abreast, one at
 * accessibility text sizes so names don't break mid-word, each opening its Plant screen; Archived
 * plants have a view of their own. Read again after writes: a photo is a row of its own, which a
 * live query over plants would miss.
 */
export default function GardenScreen() {
  const [{ plants, archivedCount }, setGarden] = useState(readGarden);
  useAfterWrites(useCallback(() => setGarden(readGarden()), []));
  const { width, fontScale } = useWindowDimensions();
  const columns = accessibilitySize(fontScale) ? 1 : 2;
  const cell = (width - 2 * space.l - (columns - 1) * space.m) / columns;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.list}>
      {plants.length === 0 ? (
        archivedCount > 0 ? (
          <EmptyState
            symbol="archive"
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
        <View style={styles.grid}>
          {plants.map((plant) => {
            const scientific = scientificBeneath(plant.displayName, plant.scientificName);
            return (
              <PressSink
                key={plant.id}
                onPress={() => router.push({ pathname: '/plants/[id]', params: { id: plant.id } })}
                style={{ width: cell }}
              >
                <PlantPhoto
                  uri={photoUri(plant.photo)}
                  size={cell}
                  name={plant.displayName}
                  radius={radius.surface}
                />
                <Text numberOfLines={2} style={[text.headline, styles.name]}>
                  {plant.displayName}
                </Text>
                {scientific && (
                  <Text numberOfLines={1} style={[text.footnote, font.italic]}>
                    {scientific}
                  </Text>
                )}
              </PressSink>
            );
          })}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.m,
    rowGap: space.xl,
    marginHorizontal: space.l,
  },
  name: { marginTop: space.s },
  footer: { alignSelf: 'center', marginTop: space.xl },
});
