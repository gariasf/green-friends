import { Button, Host, Menu, RNHostView, Section } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, LayoutAnimationConfig } from 'react-native-reanimated';

import { dueCare, evaluateCare, needsAttention, nextCare, type PlantCare } from '@/src/core/care';
import { logCareEvent } from '@/src/core/careLog';
import { localDay, localNoon } from '@/src/core/dates';
import type { CareType } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, CareSymbol } from '@/src/ui/CareEvent';
import { EmptyState } from '@/src/ui/EmptyState';
import { TextButton } from '@/src/ui/Form';
import { Icon } from '@/src/ui/Icon';
import { taskHaptic, TICK_MS, TickMark, tickHaptic, useListMotion } from '@/src/ui/motion';
import { PlantPhoto, photoUri } from '@/src/ui/Photo';
import {
  colors,
  font,
  group,
  pressedStyle,
  radius,
  space,
  target,
  text,
  useRaised,
} from '@/src/ui/theme';
import { useUndoToast } from '@/src/ui/UndoToast';
import { useAfterWritesOrForeground } from '@/src/ui/useAfterWrites';
import { useProto } from '@/src/ui/FormsPrototype';
import {
  nextCareLine,
  nextCareWhen,
  plantsNeedYou,
  plural,
  scientificBeneath,
} from '@/src/ui/words';

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
          {needingAttention.map((plant, index) => (
            <CareCard key={plant.id} plant={plant} onLog={log} hero={index === 0} />
          ))}
          {needingAttention.length === 0 && plants.length > 0 && (
            <Animated.View entering={FadeIn}>
              <EmptyState symbol="allDone" title="All caught up" />
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
 * writes (due-ness derives from several tables, and useLiveQuery re-runs on one), on returning to
 * the foreground and at midnight, where the day turns.
 */
function usePlantCare() {
  const [care, setCare] = useState(evaluateToday);
  const refresh = useCallback(() => setCare(evaluateToday()), []);
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
  { id: 'note', title: 'Add note', image: 'note.text' },
  { id: 'edit', title: 'Edit plant', image: 'pencil' },
] as const;

/** Opens what was picked from a card's ⋯. */
function openPicked({ id }: PlantCare, action: string) {
  switch (action) {
    case 'log':
      // With no type, the log sheet opens on the first Due care type. PROTOTYPE words B: on
      // Yesterday, from Log earlier….
      return router.push({ pathname: '/plants/[id]/log', params: { id, when: 'earlier' } });
    case 'note':
      return router.push({ pathname: '/plants/[id]/log', params: { id, type: 'note' } });
    case 'edit':
      return router.push({ pathname: '/plants/[id]/edit', params: { id } });
  }
}

/**
 * A plant that Needs Attention, as one surface: its photo and names, which open it, and ⋯; a row
 * per Due care type, whose circle ticks with a haptic and logs the care a beat later, as its row
 * folds away; and Log all while more than one is Due. With one Due care type it's all one row: the
 * care under the plant's name, then ⋯ and the circle (spec #84). Only the `hero`, the first and most
 * Overdue, is raised; the rest are outlined on the surface.
 */
function CareCard({
  plant,
  onLog,
  hero,
}: {
  plant: PlantCare;
  onLog: (plant: PlantCare, types: CareType[]) => void;
  hero: boolean;
}) {
  const due = dueCare(plant);
  const [ticked, setTicked] = useState<CareType[]>([]);
  const raised = useRaised();
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);
  const { layout, entering, exiting } = useListMotion();

  const tick = (types: CareType[]) => {
    const fresh = types.filter((type) => !ticked.includes(type));
    if (fresh.length === 0) return;
    setTicked([...ticked, ...fresh]);
    if (fresh.length > 1) taskHaptic();
    else tickHaptic();
    setTimeout(() => {
      onLog(plant, fresh);
      // Undone, the rows come back unticked.
      setTicked((current) => current.filter((type) => !fresh.includes(type)));
    }, TICK_MS);
  };

  const surface = hero ? raised : styles.outlined;
  const { words } = useProto();
  // iOS's own menu, which opens on a tap. SwiftUI's Menu is the button VoiceOver reads, so the
  // label goes on it; @expo/ui's MenuView drop-in can't pass it one. A bare glyph, quieter than the
  // circle beside it (spec #84).
  const more = (
    <Host matchContents ignoreSafeArea="all">
      <Menu
        label={
          <RNHostView matchContents>
            <View style={target.icon}>
              <Icon name="more" size={18} color={colors.tertiaryLabel} />
            </View>
          </RNHostView>
        }
        modifiers={[accessibilityLabel(`More for ${plant.displayName}`)]}
      >
        <Section title={plant.displayName}>
          {MORE.map(({ id, title, image }) => (
            <Button
              key={id}
              // PROTOTYPE words C: Log care…, the sheet's own title.
              label={id === 'log' && words === 'C' ? 'Log care…' : title}
              systemImage={image}
              onPress={() => openPicked(plant, id)}
            />
          ))}
        </Section>
      </Menu>
    </Host>
  );
  const circle = (type: CareType) => {
    const done = ticked.includes(type);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${CARE_COPY[type].label} ${plant.displayName}`}
        accessibilityHint="Logs it as done today"
        accessibilityState={{ checked: done, disabled: done }}
        disabled={done}
        hitSlop={8}
        onPress={() => tick([type])}
      >
        {({ pressed }) => (
          <TickMark
            done={done || pressed}
            size={30}
            circle={<Icon name="circle" size={30} color={colors.tertiaryLabel} />}
            check={<Icon name="checkCircle" size={30} color={colors.tint} />}
          />
        )}
      </Pressable>
    );
  };
  if (due.length === 1) {
    const [{ type, daysOverdue }] = due;
    const overdue = daysOverdue > 0;
    return (
      <Animated.View
        layout={layout}
        entering={entering}
        exiting={exiting}
        style={[styles.card, surface, styles.folded]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens the plant"
          onPress={() => openPlant(plant)}
          style={({ pressed }) => [styles.identity, pressed && pressedStyle.button]}
        >
          <PlantPhoto
            uri={photoUri(plant.photo)}
            focus={plant.focus}
            size={52}
            name={plant.displayName}
          />
          <View style={styles.grow}>
            <Text style={text.headline}>{plant.displayName}</Text>
            <View style={styles.foldLine}>
              <CareSymbol type={type} size={14} />
              <Text style={[styles.status, overdue ? styles.overdue : styles.dueToday]}>
                {CARE_COPY[type].label} ·{' '}
                {overdue ? `${plural(daysOverdue, 'day')} overdue` : 'due today'}
              </Text>
            </View>
          </View>
        </Pressable>
        {more}
        {circle(type)}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      layout={layout}
      entering={entering}
      exiting={exiting}
      style={[styles.card, surface]}
    >
      <View style={styles.cardHead}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens the plant"
          onPress={() => openPlant(plant)}
          style={({ pressed }) => [styles.identity, pressed && pressedStyle.button]}
        >
          <PlantPhoto
            uri={photoUri(plant.photo)}
            focus={plant.focus}
            size={52}
            name={plant.displayName}
          />
          <View style={styles.grow}>
            <Text style={text.headline}>{plant.displayName}</Text>
            {scientific && <Text style={styles.scientific}>{scientific}</Text>}
          </View>
        </Pressable>
        {more}
      </View>
      {due.map(({ type, daysOverdue }) => {
        const overdue = daysOverdue > 0;
        return (
          <Animated.View
            key={type}
            layout={layout}
            entering={entering}
            exiting={exiting}
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
            {circle(type)}
          </Animated.View>
        );
      })}
      {due.length > 1 && (
        <Animated.View layout={layout} exiting={exiting} style={[styles.cardFoot, group.divider]}>
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
  const { layout } = useListMotion();
  const window = useWindowDimensions();
  // Text grows by fontScale at every size, so a plant this much wider wraps its words as it does
  // at the default size.
  const width = peekWidth(window.width - space.l, 92 * window.fontScale, space.m, plants.length);
  return (
    <Animated.View layout={layout}>
      <Text accessibilityRole="header" style={[group.section, styles.restHeading]}>
        Everything else
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.restStrip}
      >
        {plants.map((plant) => {
          const coming = nextCare(plant, today);
          const next = nextCareLine(coming);
          return (
            <Pressable
              key={plant.id}
              accessibilityRole="button"
              accessibilityLabel={`${plant.displayName}, ${next}`}
              onPress={() => openPlant(plant)}
              style={({ pressed }) => [styles.restPlant, { width }, pressed && pressedStyle.button]}
            >
              <PlantPhoto
                uri={photoUri(plant.photo)}
                focus={plant.focus}
                size={64}
                name={plant.displayName}
              />
              <Text style={styles.restName} numberOfLines={2}>
                {plant.displayName}
              </Text>
              {coming && !(coming.paused && coming.type === 'water') ? (
                // The care type as its icon, as on the cards above, so when fits on one line.
                <View style={styles.restNext}>
                  <CareSymbol type={coming.type} size={14} />
                  <Text style={text.footnote}>{nextCareWhen(coming)}</Text>
                </View>
              ) : (
                <Text style={text.footnote}>{next}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

/**
 * The width of each plant in a strip with `room` to show them from its leading edge: at least
 * `least`, and where more follow than fit, as wide as lets the last one on screen show only half,
 * cut at the edge, so the strip plainly scrolls on (as the App Store's shelves do).
 */
function peekWidth(room: number, least: number, gap: number, count: number): number {
  for (let shown = Math.floor((room + gap) / (least + gap)); shown > 0; shown--) {
    const width = (room - shown * gap) / (shown + 0.5);
    if (width >= least) return count > shown ? width : least;
  }
  return least;
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxxl },
  dateLine: { ...text.subheadline, marginHorizontal: space.l },
  grow: { flex: 1 },
  card: {
    marginHorizontal: space.l,
    marginTop: space.m,
    borderRadius: radius.surface,
    borderCurve: 'continuous',
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
  scientific: { ...text.footnote, ...font.italic },
  outlined: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  folded: { flexDirection: 'row', alignItems: 'center', paddingRight: space.l },
  foldLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
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
  rowLabel: { ...text.subheadline, ...font.semibold, color: colors.label },
  status: { ...text.footnote, ...font.semibold },
  overdue: { color: colors.caution },
  dueToday: { color: colors.dueToday },
  cardFoot: {
    alignItems: 'flex-end',
    marginLeft: space.l,
    paddingRight: space.l,
    paddingVertical: space.m,
  },
  // In line with the cards and the strip.
  restHeading: { marginTop: space.xxl, marginBottom: space.s, marginHorizontal: space.l },
  restStrip: { gap: space.m, paddingHorizontal: space.l, paddingVertical: space.s },
  restPlant: { gap: space.xs },
  restName: { ...text.footnote, ...font.semibold, color: colors.label },
  restNext: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
