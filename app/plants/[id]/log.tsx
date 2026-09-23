import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { careLogQuery, type CareEvent } from '@/src/core/careLog';
import { localDay } from '@/src/core/dates';
import { getDisplayName } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, dayLabel } from '@/src/ui/care';

/** A plant's Care Log (spec #8): every Care Event, newest first; each opens to be edited or deleted. */
export default function CareLogScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]/log'>();
  const [displayName] = useState(() => getDisplayName(db, id));
  const { data: events, updatedAt } = useLiveQuery(careLogQuery(db, id));
  const today = localDay(new Date());

  return (
    <>
      <Stack.Screen options={{ title: displayName }} />
      {updatedAt && (
        <FlatList
          data={events}
          keyExtractor={(event) => event.id}
          contentContainerStyle={events.length === 0 ? styles.empty : undefined}
          ListEmptyComponent={<Text style={styles.hint}>Nothing logged yet.</Text>}
          renderItem={({ item }) => <CareEventRow event={item} today={today} />}
        />
      )}
    </>
  );
}

function CareEventRow({ event, today }: { event: CareEvent; today: string }) {
  const copy = CARE_COPY[event.type];
  const day = dayLabel(event.occurredOn, today);
  const detail = [event.potSizeCm !== null && `${event.potSizeCm} cm`, event.soil, event.note]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[copy.done, day, detail].filter(Boolean).join(', ')}
      accessibilityHint="Edit or delete"
      onPress={() => router.push({ pathname: '/care-events/[id]', params: { id: event.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.icon}>{copy.icon}</Text>
      <View style={styles.grow}>
        <Text style={styles.label}>{copy.done}</Text>
        {detail ? <Text style={styles.hint}>{detail}</Text> : null}
      </View>
      <Text style={styles.hint}>{day}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  rowPressed: { backgroundColor: '#f2f2f7' },
  icon: { fontSize: 20 },
  grow: { flex: 1, gap: 2 },
  label: { fontSize: 17, fontWeight: '500' },
  hint: { fontSize: 14, color: '#666' },
  chevron: { fontSize: 20, color: '#aeaeb5' },
});
