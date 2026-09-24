import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { careLogQuery, type CareEvent } from '@/src/core/careLog';
import { localDay } from '@/src/core/dates';
import { getDisplayName } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, CareSymbol, dayLabel } from '@/src/ui/CareEvent';
import { colors, group, pressedStyle, space, text } from '@/src/ui/theme';

/** A plant's Care Log (spec #8): every Care Event, newest first; each opens to be edited or deleted. */
export default function CareLogScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]/log'>();
  const [displayName] = useState(() => getDisplayName(db, id));
  const { data: events, updatedAt } = useLiveQuery(careLogQuery(db, id));
  const today = localDay(new Date());

  return (
    <>
      <Stack.Screen options={{ title: displayName }} />
      {/* ponytail: renders every Care Event at once; back to a FlatList if a Care Log ever runs
          into the thousands. */}
      {updatedAt && (
        <ScrollView contentContainerStyle={events.length === 0 ? styles.empty : styles.list}>
          {events.length === 0 ? (
            <Text style={text.subheadline}>Nothing logged yet.</Text>
          ) : (
            <View style={group.box}>
              {events.map((event, index) => (
                <CareEventRow key={event.id} event={event} today={today} first={index === 0} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </>
  );
}

function CareEventRow({
  event,
  today,
  first,
}: {
  event: CareEvent;
  today: string;
  first: boolean;
}) {
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
      style={({ pressed }) => [group.row, !first && group.divider, pressed && pressedStyle.row]}
    >
      <CareSymbol type={event.type} size={20} />
      <View style={styles.grow}>
        <Text style={text.body}>{copy.done}</Text>
        {detail ? <Text style={text.subheadline}>{detail}</Text> : null}
      </View>
      <Text style={text.subheadline}>{day}</Text>
      <SymbolView
        name="chevron.right"
        size={14}
        weight="semibold"
        tintColor={colors.tertiaryLabel}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  list: { paddingVertical: space.l },
  grow: { flex: 1 },
});
