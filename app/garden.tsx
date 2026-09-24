import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import { listArchivedPlants, listPlants } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { PlantRow } from '@/src/ui/PlantRow';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

function readGarden() {
  return { plants: listPlants(db), archived: listArchivedPlants(db).length };
}

/**
 * Garden: every live plant by Display Name, with its photo, each opening its plant sheet; Archived
 * plants have a view of their own. Read again after writes: a photo is a row of its own, which a
 * live query over plants would miss.
 */
export default function GardenScreen() {
  const [{ plants, archived }, setGarden] = useState(readGarden);
  useAfterWrites(useCallback(() => setGarden(readGarden()), []));

  return (
    <FlatList
      data={plants}
      keyExtractor={(plant) => plant.id}
      contentContainerStyle={plants.length === 0 ? styles.empty : undefined}
      ListEmptyComponent={
        <>
          <Text style={styles.title}>No plants yet</Text>
          <Text style={styles.hint}>Tap + to add your first plant.</Text>
        </>
      }
      ListFooterComponent={
        archived > 0 ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/archived')}
            style={styles.footer}
          >
            <Text style={styles.link}>Archived · {archived} ›</Text>
          </Pressable>
        ) : null
      }
      renderItem={({ item }) => (
        <PlantRow
          photo={item.photo}
          name={item.displayName}
          detail={item.scientificName}
          onPress={() => router.push({ pathname: '/plants/[id]', params: { id: item.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  hint: { fontSize: 14, color: '#666' },
  footer: { padding: 20, alignItems: 'center' },
  link: { fontSize: 16, color: '#2e7d32', fontWeight: '600' },
});
