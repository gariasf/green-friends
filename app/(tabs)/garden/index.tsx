import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { evaluateCare } from '@/src/core/care';
import { localDay } from '@/src/core/dates';
import { listArchivedPlants, listPlants } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { nextCare } from '@/src/ui/CareEvent';
import { TextButton } from '@/src/ui/Form';
import { PlantRow, scientificBeneath } from '@/src/ui/PlantRow';
import { colors, group, space, text } from '@/src/ui/theme';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

function readGarden() {
  return {
    plants: listPlants(db),
    care: new Map(evaluateCare(db).map((plant) => [plant.id, plant])),
    archivedCount: listArchivedPlants(db).length,
  };
}

/**
 * Garden: every plant in care by Display Name, each with its next care, each opening its Plant
 * screen; Archived plants have a view of their own. PROTOTYPE (UI pass): an inset grouped list.
 */
export default function GardenScreen() {
  const [{ plants, care, archivedCount }, setGarden] = useState(readGarden);
  useAfterWrites(useCallback(() => setGarden(readGarden()), []));
  const today = localDay(new Date());

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {plants.length === 0 ? (
        <View style={styles.empty}>
          <SymbolView name="leaf" size={48} tintColor={colors.tint} />
          <Text style={text.title3}>
            {archivedCount > 0 ? 'No plants in care' : 'No plants yet'}
          </Text>
          <TextButton label="Add a plant" onPress={() => router.push('/plants/new')} />
        </View>
      ) : (
        <View style={group.box}>
          {plants.map((item, index) => {
            const plant = care.get(item.id);
            return (
              <PlantRow
                key={item.id}
                first={index === 0}
                photo={item.photo}
                name={item.displayName}
                detail={scientificBeneath(item.displayName, item.scientificName)}
                status={plant ? nextCare(plant, today) : null}
                onPress={() => router.push({ pathname: '/plants/[id]', params: { id: item.id } })}
              />
            );
          })}
        </View>
      )}
      {archivedCount > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/archived')}
          style={({ pressed }) => [group.box, styles.archived, pressed && styles.pressed]}
        >
          <SymbolView name="archivebox" size={18} tintColor={colors.secondaryLabel} />
          <Text style={[text.body, styles.grow]}>Archived</Text>
          <Text style={text.subheadline}>{archivedCount}</Text>
          <SymbolView
            name="chevron.right"
            size={14}
            weight="semibold"
            tintColor={colors.tertiaryLabel}
          />
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.s, paddingBottom: 120, gap: space.xl },
  empty: { alignItems: 'center', gap: space.s, paddingVertical: 64 },
  archived: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l },
  grow: { flex: 1 },
  pressed: { opacity: 0.6 },
});
