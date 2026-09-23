import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { listPlants } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { PlantPhoto, photoUri } from '@/src/ui/Photo';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

/**
 * Garden: every live plant by Display Name, with its photo, read again after writes: a photo is a
 * row of its own, which a live query over plants would miss.
 */
export default function GardenScreen() {
  const [plants, setPlants] = useState(() => listPlants(db));
  useAfterWrites(useCallback(() => setPlants(listPlants(db)), []));

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
      renderItem={({ item }) => (
        <View style={styles.row}>
          <PlantPhoto uri={photoUri(item.photo)} size={44} />
          <View style={styles.grow}>
            <Text style={styles.name}>{item.displayName}</Text>
            {item.scientificName && <Text style={styles.hint}>{item.scientificName}</Text>}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  grow: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '500' },
  hint: { fontSize: 14, color: '#666' },
});
