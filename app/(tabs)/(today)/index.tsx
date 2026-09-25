import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';

import {
  dueCare,
  evaluateCare,
  needsAttention,
  nextCare,
  type NextCare,
  type PlantCare,
} from '@/src/core/care';
import { logCareEvent } from '@/src/core/careLog';
import { localDay, localNoon } from '@/src/core/dates';
import type { CareType } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, CareSymbol, daysOrMonths, plantsNeedYou, plural } from '@/src/ui/CareEvent';
import { EmptyState } from '@/src/ui/EmptyState';
import { TextButton } from '@/src/ui/Form';
import { PlantPhoto, photoUri } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/PlantRow';
import { colors, group, pressedStyle, space, target, text } from '@/src/ui/theme';
import { useUndoToast } from '@/src/ui/UndoToast';
import { useAfterWritesOrForeground } from '@/src/ui/useAfterWrites';

/** How long a circle shows its tick before the care is logged and its row folds away. */
const TICK_MS = 250;

/**
 * How a row or a card leaves: a fade quicker than the move of what takes its place, so that never
 * shows through it.
 */
const FOLD = FadeOut.duration(150);

/**
 * Today (spec #8, prototype #6; spec #22): the day and how many plants need you, then one card per
 * plant that Needs Attention, most Overdue first, with a row per Due care type whose circle logs it
 * as done today in one tap; below, everything else in the garden with its next care. Tapping a
 * plant opens its Plant screen, and a card's ⋯ opens a menu of what else there is to do. With no
 * plant in care, as on a fresh install, it offers to add one. Cards and rows fade in and out as
 * care is logged or falls Due, and the rest move into place.
 */
export default function TodayScreen() {
  const [{ today, plants }, refresh] = usePlantCare();
  const undo = useUndoToast(refresh);

  const log = (plant: PlantCare, types: CareType[]) => {
    const eventIds = types.map((type) => logCareEvent(db, { plantId: plant.id, type }).id);
    refresh();
    undo.offer(
      types.length === 1
        ? `${CARE_COPY[types[0]].done} ${plant.displayName}`
        : `Logged everything for ${plant.displayName}`,
      eventIds,
    );
  };

  const needingAttention = plants.filter(needsAttention);
  const rest = plants.filter((plant) => !needsAttention(plant));
  const date = localNoon(today).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // The ScrollView comes first, so the large title collapses into the header as it scrolls and a
  // tap on the tab scrolls back to the top.
  return (
    <>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text style={styles.dateLine}>
          {needingAttention.length > 0
            ? `${date} · ${plantsNeedYou(needingAttention.length)}`
            : date}
        </Text>
        {/* What is there when Today opens is simply there; only later changes animate. */}
        <LayoutAnimationConfig skipEntering>
          {needingAttention.map((plant) => (
            <CareCard key={plant.id} plant={plant} onLog={log} />
          ))}
          {needingAttention.length === 0 && plants.length > 0 && (
            <Animated.View entering={FadeIn}>
              <EmptyState
                symbol="checkmark.seal"
                title="All caught up"
                line="Nothing needs you today."
              />
            </Animated.View>
          )}
          {plants.length === 0 && (
            <Animated.View entering={FadeIn}>
              <EmptyState
                symbol="leaf"
                title="No plants in care"
                line="Add one, and Today shows when it needs you."
                action={{ label: 'Add a plant', onPress: () => router.push('/plants/new') }}
              />
            </Animated.View>
          )}
          {rest.length > 0 && <RestOfGarden plants={rest} today={today} />}
        </LayoutAnimationConfig>
      </ScrollView>
      {undo.toast}
    </>
  );
}

/**
 * Every plant's care state today (evaluateCare) and the day it is for, evaluated again after
 * writes (due-ness derives from several tables, and useLiveQuery re-runs on one) and on returning
 * to the foreground, where the day may have turned.
 */
function usePlantCare() {
  const [care, setCare] = useState(evaluateToday);
  const refresh = useCallback(() => setCare(evaluateToday()), []);
  // ponytail: left open across midnight, Today shows yesterday until the next write or
  // foregrounding; add a timer for the next local midnight if that ever matters.
  useAfterWritesOrForeground(refresh);
  return [care, refresh] as const;
}

function evaluateToday() {
  const today = localDay(new Date());
  return { today, plants: evaluateCare(db, today) };
}

function openPlant(plant: PlantCare) {
  router.push({ pathname: '/plants/[id]', params: { id: plant.id } });
}

/** What a card's ⋯ offers besides the one-tap log. */
const MORE = [
  { id: 'log', title: 'Log earlier…', image: 'calendar' },
  { id: 'note', title: 'Add note', image: CARE_COPY.note.symbol },
  { id: 'edit', title: 'Edit plant', image: 'pencil' },
] satisfies MenuAction[];

/** Opens what was picked from a card's ⋯. */
function openPicked({ id }: PlantCare, action: string) {
  switch (action) {
    case 'log':
      // With no type, the log sheet opens on the first Due care type.
      return router.push({ pathname: '/plants/[id]/log', params: { id } });
    case 'note':
      return router.push({ pathname: '/plants/[id]/log', params: { id, type: 'note' } });
    case 'edit':
      return router.push({ pathname: '/plants/[id]/edit', params: { id } });
  }
}

/**
 * A plant that Needs Attention, as one surface: its photo and names, which open it, and ⋯; a row
 * per Due care type, whose circle ticks with a haptic and logs the care a beat later, as its row
 * folds away; and Log all while more than one is Due. A red edge marks Overdue care.
 */
function CareCard({
  plant,
  onLog,
}: {
  plant: PlantCare;
  onLog: (plant: PlantCare, types: CareType[]) => void;
}) {
  const due = dueCare(plant);
  const [ticked, setTicked] = useState<CareType[]>([]);
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);

  const tick = (types: CareType[]) => {
    const fresh = types.filter((type) => !ticked.includes(type));
    if (fresh.length === 0) return;
    setTicked([...ticked, ...fresh]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      onLog(plant, fresh);
      // Undone, the rows come back unticked.
      setTicked((current) => current.filter((type) => !fresh.includes(type)));
    }, TICK_MS);
  };

  return (
    <Animated.View layout={LinearTransition} entering={FadeIn} exiting={FOLD} style={styles.card}>
      {due.some((item) => item.daysOverdue > 0) && <View style={styles.overdueEdge} />}
      <View style={styles.cardHead}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens the plant"
          onPress={() => openPlant(plant)}
          style={({ pressed }) => [styles.identity, pressed && pressedStyle.button]}
        >
          <PlantPhoto uri={photoUri(plant.photo)} size={52} />
          <View style={styles.grow}>
            <Text style={text.headline}>{plant.displayName}</Text>
            {scientific && <Text style={styles.scientific}>{scientific}</Text>}
          </View>
        </Pressable>
        {/* iOS's own menu, which opens on a tap. */}
        <MenuView
          title={plant.displayName}
          actions={MORE}
          onPressAction={({ nativeEvent }) => openPicked(plant, nativeEvent.event)}
        >
          <View accessibilityLabel={`More for ${plant.displayName}`} style={target.icon}>
            <View style={styles.more}>
              <SymbolView
                name="ellipsis"
                size={16}
                weight="bold"
                tintColor={colors.secondaryLabel}
              />
            </View>
          </View>
        </MenuView>
      </View>
      {due.map(({ type, daysOverdue }) => {
        const overdue = daysOverdue > 0;
        const done = ticked.includes(type);
        return (
          <Animated.View
            key={type}
            layout={LinearTransition}
            entering={FadeIn}
            exiting={FOLD}
            style={[styles.row, group.divider]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Opens the plant"
              onPress={() => openPlant(plant)}
              style={({ pressed }) => [styles.rowBody, pressed && pressedStyle.button]}
            >
              <CareSymbol type={type} size={20} />
              <View style={styles.grow}>
                <Text style={styles.rowLabel}>{CARE_COPY[type].label}</Text>
                <Text style={[styles.status, overdue ? styles.overdue : styles.dueToday]}>
                  {overdue ? `${plural(daysOverdue, 'day')} overdue` : 'Due today'}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${CARE_COPY[type].label} ${plant.displayName}`}
              disabled={done}
              // 30 pt across; this makes it a 46 pt target.
              hitSlop={8}
              onPress={() => tick([type])}
            >
              {({ pressed }) => (
                <SymbolView
                  name={done || pressed ? 'checkmark.circle.fill' : 'circle'}
                  size={30}
                  tintColor={done || pressed ? colors.tint : colors.tertiaryLabel}
                />
              )}
            </Pressable>
          </Animated.View>
        );
      })}
      {due.length > 1 && (
        <Animated.View
          layout={LinearTransition}
          exiting={FOLD}
          style={[styles.cardFoot, group.divider]}
        >
          <TextButton
            label="Log all"
            accessibilityLabel={`Log all due care for ${plant.displayName}`}
            onPress={() => tick(due.map((item) => item.type))}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** The plants that need nothing today, each with its next care, in a strip. */
function RestOfGarden({ plants, today }: { plants: PlantCare[]; today: string }) {
  // Text grows by fontScale at every size, so a plant this much wider wraps its words as it does
  // at the default size.
  const width = 84 * useWindowDimensions().fontScale;
  return (
    <Animated.View layout={LinearTransition}>
      <Text style={[group.header, styles.restHeading]}>Everything else</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.restStrip}
      >
        {plants.map((plant) => {
          const next = nextCareLine(nextCare(plant, today));
          return (
            <Pressable
              key={plant.id}
              accessibilityRole="button"
              accessibilityLabel={`${plant.displayName}, ${next}`}
              onPress={() => openPlant(plant)}
              style={({ pressed }) => [styles.restPlant, { width }, pressed && pressedStyle.button]}
            >
              <PlantPhoto uri={photoUri(plant.photo)} size={64} />
              <Text style={styles.restName} numberOfLines={2}>
                {plant.displayName}
              </Text>
              <Text style={text.caption}>{next}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

/**
 * The next care of a plant that needs nothing today, which is always days ahead: "Water in 3
 * days", "Fertilize tomorrow"; "Resting" while it waits for its Growing season.
 */
function nextCareLine(next: NextCare | null): string {
  if (next === null) return 'No schedule';
  if (next.paused) return 'Resting';
  const { label } = CARE_COPY[next.type];
  if (next.days === 1) return `${label} tomorrow`;
  const [count, unit] = daysOrMonths(next.days);
  return `${label} in ${plural(count, unit)}`;
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxxl },
  dateLine: { ...text.subheadline, marginHorizontal: space.l },
  grow: { flex: 1 },
  card: {
    marginHorizontal: space.l,
    marginTop: space.m,
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
    backgroundColor: colors.danger,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', paddingRight: space.s },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    paddingLeft: space.l,
  },
  scientific: { ...text.caption, fontStyle: 'italic' },
  more: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  // Inset from the card's left edge, as iOS insets a divider.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
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
  rowLabel: { ...text.subheadline, fontWeight: '600', color: colors.label },
  status: { ...text.footnote, fontWeight: '600' },
  overdue: { color: colors.danger },
  dueToday: { color: colors.dueToday },
  cardFoot: {
    alignItems: 'flex-end',
    marginLeft: space.l,
    paddingRight: space.l,
    paddingVertical: space.m,
  },
  // In line with the cards and the strip, not inset as over a group of rows.
  restHeading: { marginHorizontal: space.l },
  restStrip: { gap: space.m, paddingHorizontal: space.l, paddingVertical: space.s },
  restPlant: { gap: space.xs },
  restName: { ...text.caption, fontWeight: '600', color: colors.label },
});
