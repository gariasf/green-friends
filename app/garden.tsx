import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { plantListQuery } from '@/src/core/plants';
import { db } from '@/src/db/client';

/** Garden: every live plant by Display Name. Re-renders on every plants write. */
export default function GardenScreen() {
  const { data: plants, updatedAt } = useLiveQuery(plantListQuery(db));
  if (!updatedAt) return null;

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
          <Text style={styles.name}>{item.displayName}</Text>
          {item.scientificName && <Text style={styles.hint}>{item.scientificName}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  name: { fontSize: 17, fontWeight: '500' },
  hint: { fontSize: 14, color: '#666' },
});
