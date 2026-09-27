import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { listArchivedPlants, listPlants, type PlantListItem } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { EmptyState } from '@/src/ui/EmptyState';
import { TextButton } from '@/src/ui/Form';
import { PlantPhoto, photoUri } from '@/src/ui/Photo';
import { PlantRow } from '@/src/ui/PlantRow';
import { surfaces } from '@/src/ui/SurfacesPrototype';
import { scientificBeneath } from '@/src/ui/words';
import { font, group, pressedStyle, radius, space, text } from '@/src/ui/theme';
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
      ) : surfaces.garden === 'B' ? (
        <GardenGrid plants={plants} />
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

function openPlant(id: string) {
  router.push({ pathname: '/plants/[id]', params: { id } });
}

/**
 * PROTOTYPE (prototype/surfaces, garden B): the plants as a grid of photos, two abreast, each square
 * and at one radius so mixed photos look tidy, the names below; a plant without a photo shows its
 * initial on Ecru.
 */
function GardenGrid({ plants }: { plants: PlantListItem[] }) {
  const size = (useWindowDimensions().width - space.l * 2 - space.m) / 2;
  return (
    <View style={styles.grid}>
      {plants.map((plant) => {
        const scientific = scientificBeneath(plant.displayName, plant.scientificName);
        return (
          <Pressable
            key={plant.id}
            accessibilityRole="button"
            accessibilityLabel={[plant.displayName, scientific].filter(Boolean).join(', ')}
            onPress={() => openPlant(plant.id)}
            style={({ pressed }) => [{ width: size }, styles.cell, pressed && pressedStyle.button]}
          >
            <PlantPhoto
              uri={photoUri(plant.photo)}
              size={size}
              name={plant.displayName}
              corner={radius.card}
            />
            <Text style={text.headline} numberOfLines={2}>
              {plant.displayName}
            </Text>
            {scientific && (
              <Text style={styles.scientific} numberOfLines={1}>
                {scientific}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: space.l },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.m,
    rowGap: space.xl,
    paddingHorizontal: space.l,
  },
  cell: { gap: space.xs },
  scientific: { ...text.footnote, ...font.italic },
  footer: { alignSelf: 'center', marginTop: space.xl },
});
