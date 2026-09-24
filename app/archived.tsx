import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';

import { localDay } from '@/src/core/dates';
import { listArchivedPlants } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { dayLabel } from '@/src/ui/CareEvent';
import { PlantRow } from '@/src/ui/PlantRow';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

/**
 * Archived plants (CONTEXT.md): out of care, their Care Log and photo kept. Each opens its details,
 * where it can be unarchived or deleted.
 */
export default function ArchivedScreen() {
  const [plants, setPlants] = useState(() => listArchivedPlants(db));
  useAfterWrites(useCallback(() => setPlants(listArchivedPlants(db)), []));
  const today = localDay(new Date());

  return (
    <FlatList
      data={plants}
      keyExtractor={(plant) => plant.id}
      contentContainerStyle={plants.length === 0 ? styles.empty : undefined}
      ListEmptyComponent={<Text style={styles.hint}>No archived plants.</Text>}
      renderItem={({ item }) => (
        <PlantRow
          photo={item.photo}
          name={item.displayName}
          detail={
            item.archivedAt && `Archived · ${dayLabel(localDay(new Date(item.archivedAt)), today)}`
          }
          onPress={() => router.push({ pathname: '/plants/[id]/edit', params: { id: item.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { fontSize: 14, color: '#666' },
});
