import { MenuView } from '@expo/ui/community/menu';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  dueCare,
  evaluateCare,
  needsAttention,
  type DueCare,
  type PlantCare,
} from '@/src/core/care';
import { deleteCareEvent, logCareEvent } from '@/src/core/careLog';
import { localDay } from '@/src/core/dates';
import type { CareType } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, nextCare, plantsNeedYou } from '@/src/ui/CareEvent';
import { TextButton } from '@/src/ui/Form';
import { PlantPhoto, photoUri } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/PlantRow';
import { colors, group, space, text } from '@/src/ui/theme';
import { useAfterWritesOrForeground } from '@/src/ui/useAfterWrites';

const UNDO_MS = 4000;

type Undo = { message: string; eventIds: string[] };

/**
 * Today (spec #8, prototype #6), PROTOTYPE (UI pass): one card per plant that Needs Attention,
 * most Overdue first, with a row per Due care type. Tapping the plant opens it; the circle logs
 * that care as done today; ⋯ holds the other actions. The rest of the garden follows, each with
 * its next care.
 */
export default function TodayScreen() {
  const [plants, refresh] = usePlantCare();
  const [undo, setUndo] = useState<Undo | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!undo) return;
    AccessibilityInfo.announceForAccessibility(`${undo.message}. Undo available.`);
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const log = (plant: PlantCare, types: CareType[]) => {
    const eventIds = types.map((type) => logCareEvent(db, { plantId: plant.id, type }).id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
    setUndo({
      message:
        types.length === 1
          ? `${CARE_COPY[types[0]].done} ${plant.displayName}`
          : `Logged everything for ${plant.displayName}`,
      eventIds,
    });
  };

  const revert = ({ eventIds }: Undo) => {
    for (const id of eventIds) deleteCareEvent(db, id);
    refresh();
    setUndo(null);
  };

  const today = localDay(new Date());
  const needingAttention = plants.filter(needsAttention);
  const rest = plants.filter((plant) => !needsAttention(plant));
  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
      >
        <Text style={styles.dateLine}>
          {date}
          {needingAttention.length > 0 && ` · ${plantsNeedYou(needingAttention.length)}`}
        </Text>
        {needingAttention.map((plant) => (
          <CareCard key={plant.id} plant={plant} onLog={log} />
        ))}
        {needingAttention.length === 0 &&
          (plants.length > 0 ? (
            <Empty symbol="checkmark.seal" title="All caught up" hint="Nothing needs you today." />
          ) : (
            <Empty symbol="leaf" title="No plants in care">
              <TextButton label="Add a plant" onPress={() => router.push('/plants/new')} />
            </Empty>
          ))}
        {rest.length > 0 && <RestOfGarden plants={rest} today={today} />}
      </ScrollView>
      {undo && <UndoToast message={undo.message} onUndo={() => revert(undo)} />}
    </>
  );
}

/**
 * Every plant's care state for today (evaluateCare), re-evaluated after writes (due-ness derives
 * from several tables, and useLiveQuery re-runs on one) and on returning to the foreground, where
 * the day may have turned.
 */
function usePlantCare() {
  const [plants, setPlants] = useState(() => evaluateCare(db));
  const refresh = useCallback(() => setPlants(evaluateCare(db)), []);
  // ponytail: left open across midnight, Today shows yesterday until the next write or
  // foregrounding; add a timer for the next local midnight if that ever matters.
  useAfterWritesOrForeground(refresh);
  return [plants, refresh] as const;
}

function openPlant(plant: PlantCare) {
  router.push({ pathname: '/plants/[id]', params: { id: plant.id } });
}

function CareCard({
  plant,
  onLog,
}: {
  plant: PlantCare;
  onLog: (plant: PlantCare, types: CareType[]) => void;
}) {
  const due = dueCare(plant);
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);
  const overdue = due.some((item) => item.daysOverdue > 0);

  const act = (action: string) => {
    if (action === 'edit') {
      router.push({ pathname: '/plants/[id]/edit', params: { id: plant.id } });
      return;
    }
    const type = action === 'note' ? 'note' : due[0].type;
    router.push({ pathname: '/plants/[id]/log', params: { id: plant.id, type } });
  };

  return (
    <Animated.View
      layout={LinearTransition}
      entering={FadeIn}
      exiting={FadeOut}
      style={styles.card}
    >
      {overdue && <View style={styles.overdueEdge} />}
      <View style={styles.cardHead}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens the plant"
          onPress={() => openPlant(plant)}
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <PlantPhoto uri={photoUri(plant.photo)} size={52} />
          <View style={styles.grow}>
            <Text style={text.headline} numberOfLines={1}>
              {plant.displayName}
            </Text>
            {scientific && (
              <Text style={styles.scientific} numberOfLines={1}>
                {scientific}
              </Text>
            )}
          </View>
        </Pressable>
        <MenuView
          title={plant.displayName}
          actions={[
            { id: 'log', title: 'Log earlier…', image: 'calendar' },
            { id: 'note', title: 'Add note', image: 'square.and.pencil' },
            { id: 'edit', title: 'Edit plant', image: 'pencil' },
          ]}
          onPressAction={({ nativeEvent }) => act(nativeEvent.event)}
        >
          <View style={styles.more} accessibilityLabel={`More for ${plant.displayName}`}>
            <SymbolView name="ellipsis" size={16} weight="bold" tintColor={colors.secondaryLabel} />
          </View>
        </MenuView>
      </View>
      {due.map((item) => (
        <DueRow
          key={item.type}
          item={item}
          plantName={plant.displayName}
          onOpen={() => openPlant(plant)}
          onLog={() => onLog(plant, [item.type])}
        />
      ))}
      {due.length > 1 && (
        <View style={[styles.cardFoot, group.divider]}>
          <TextButton
            label="Log all"
            onPress={() =>
              onLog(
                plant,
                due.map((item) => item.type),
              )
            }
          />
        </View>
      )}
    </Animated.View>
  );
}

function DueRow({
  item,
  plantName,
  onOpen,
  onLog,
}: {
  item: DueCare;
  plantName: string;
  onOpen: () => void;
  onLog: () => void;
}) {
  const [done, setDone] = useState(false);
  const copy = CARE_COPY[item.type];
  const overdue = item.daysOverdue > 0;
  const status = overdue
    ? `${item.daysOverdue} ${item.daysOverdue === 1 ? 'day' : 'days'} overdue`
    : 'Due today';
  return (
    <Animated.View exiting={FadeOut.duration(160)} style={[styles.row, group.divider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${copy.label}, ${status}`}
        accessibilityHint="Opens the plant"
        onPress={onOpen}
        style={({ pressed }) => [styles.rowBody, pressed && styles.pressed]}
      >
        <SymbolView name={copy.symbol} size={20} tintColor={copy.hue} style={styles.rowIcon} />
        <View style={styles.grow}>
          <Text style={styles.rowLabel}>{copy.label}</Text>
          <Text style={[styles.rowStatus, { color: overdue ? colors.overdue : colors.dueToday }]}>
            {status}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${copy.label} ${plantName}, done today`}
        hitSlop={10}
        disabled={done}
        onPress={() => {
          setDone(true);
          // A beat for the tick to show before the row folds away.
          setTimeout(onLog, 250);
        }}
      >
        <SymbolView
          name={done ? 'checkmark.circle.fill' : 'circle'}
          size={30}
          tintColor={done ? colors.tint : colors.tertiaryLabel}
        />
      </Pressable>
    </Animated.View>
  );
}

function RestOfGarden({ plants, today }: { plants: PlantCare[]; today: string }) {
  return (
    <Animated.View layout={LinearTransition}>
      <Text style={[text.sectionHeader, styles.restHeading]}>Everything else</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.restStrip}
      >
        {plants.map((plant) => (
          <Pressable
            key={plant.id}
            accessibilityRole="button"
            accessibilityLabel={`${plant.displayName}, ${nextCare(plant, today)}`}
            onPress={() => openPlant(plant)}
            style={({ pressed }) => [styles.restPlant, pressed && styles.pressed]}
          >
            <PlantPhoto uri={photoUri(plant.photo)} size={64} />
            <Text style={styles.restName} numberOfLines={1}>
              {plant.displayName}
            </Text>
            <Text style={styles.restNext} numberOfLines={2}>
              {nextCare(plant, today)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function Empty({
  symbol,
  title,
  hint,
  children,
}: {
  symbol: 'leaf' | 'checkmark.seal';
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <SymbolView name={symbol} size={48} tintColor={colors.tint} />
      <Text style={text.title3}>{title}</Text>
      {hint && <Text style={[text.subheadline, styles.centered]}>{hint}</Text>}
      {children}
    </View>
  );
}

function UndoToast({ message, onUndo }: { message: string; onUndo: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(200)}
      style={[styles.toast, { bottom: insets.bottom + 64 }]}
    >
      <SymbolView name="checkmark.circle.fill" size={20} tintColor={colors.tint} />
      <Text style={styles.toastText} numberOfLines={2}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" hitSlop={12} onPress={onUndo}>
        <Text style={styles.toastUndo}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.xs, gap: space.m },
  dateLine: { ...text.subheadline, marginHorizontal: space.xl, marginBottom: space.xs },
  grow: { flex: 1 },
  centered: { textAlign: 'center' },
  pressed: { opacity: 0.55 },
  card: {
    marginHorizontal: space.l,
    borderRadius: 16,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  overdueEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.overdue,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingRight: space.m,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    paddingLeft: space.l,
  },
  scientific: { ...text.subheadline, fontStyle: 'italic' },
  more: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: space.l,
    paddingRight: space.l,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.m,
  },
  rowIcon: { width: 24, height: 24 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: colors.label },
  rowStatus: { fontSize: 14, fontWeight: '500' },
  cardFoot: {
    alignItems: 'flex-end',
    marginLeft: space.l,
    paddingRight: space.l,
    paddingVertical: space.m,
  },
  empty: { alignItems: 'center', gap: space.s, paddingHorizontal: space.xxxl, paddingVertical: 56 },
  restHeading: { marginTop: space.xl, marginHorizontal: space.xl },
  restStrip: { gap: space.m, paddingHorizontal: space.l, paddingVertical: space.s },
  restPlant: { width: 84, gap: space.xs },
  restName: { fontSize: 14, fontWeight: '600', color: colors.label },
  restNext: { ...text.caption },
  toast: {
    position: 'absolute',
    left: space.l,
    right: space.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.m + 2,
    paddingHorizontal: space.l,
    borderRadius: 16,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  toastText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.label },
  toastUndo: { fontSize: 15, fontWeight: '700', color: colors.tint },
});
