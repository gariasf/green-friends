import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dueCare, evaluateCare, needsAttention, type PlantCare } from '@/src/core/care';
import { deleteCareEvent, logCareEvent } from '@/src/core/careLog';
import type { CareType } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, CareSymbol, plantsNeedYou } from '@/src/ui/CareEvent';
import { TextButton } from '@/src/ui/Form';
import { PlantPhoto, photoUri } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/PlantRow';
import { colors, group, pressedStyle, space, text } from '@/src/ui/theme';
import { useAfterWritesOrForeground } from '@/src/ui/useAfterWrites';

const UNDO_MS = 4000;

type Undo = { message: string; eventIds: string[] };

/**
 * Today (spec #8, prototype #6): one card per plant that Needs Attention, most Overdue first, with
 * a checklist row per Due care type that logs it as done today in one tap; the rest of the garden
 * dimmed below. A card's ⋯, or any plant's name or photo, opens its plant sheet. With no plant in
 * care, as on a fresh install, it offers to add one. Cards and rows fade in and out as care is
 * logged or falls Due, and the rest move into place.
 */
export default function TodayScreen() {
  const [plants, refresh] = usePlantCare();
  const [undo, setUndo] = useState<Undo | null>(null);

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

  const needingAttention = plants.filter(needsAttention);
  const rest = plants.filter((plant) => !needsAttention(plant));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* What is there when Today opens is simply there; only later changes animate. */}
        <LayoutAnimationConfig skipEntering>
          {needingAttention.length > 0 ? (
            <>
              <Text style={styles.summary}>{plantsNeedYou(needingAttention.length)}</Text>
              {needingAttention.map((plant) => (
                <CareCard key={plant.id} plant={plant} onLog={log} />
              ))}
            </>
          ) : plants.length > 0 ? (
            <Animated.View entering={FadeIn} style={styles.empty}>
              <SymbolView name="checkmark.seal" size={48} tintColor={colors.tint} />
              <Text style={text.title2}>All caught up</Text>
              <Text style={styles.hint}>Nothing needs you today.</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} style={styles.empty}>
              <SymbolView name="leaf" size={48} tintColor={colors.tint} />
              <Text style={text.title2}>No plants in care</Text>
              <TextButton
                label="Add a plant"
                onPress={() => router.push('/plants/new')}
                style={styles.emptyAction}
              />
            </Animated.View>
          )}
          {rest.length > 0 && <RestOfGarden plants={rest} />}
        </LayoutAnimationConfig>
      </ScrollView>
      {undo && <UndoToast message={undo.message} onUndo={() => revert(undo)} />}
    </View>
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

function openPlantSheet(plant: PlantCare) {
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
  const dueTypes = due.map((item) => item.type);
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);

  return (
    <Animated.View
      layout={LinearTransition}
      entering={FadeIn}
      exiting={FadeOut}
      style={styles.card}
    >
      {due.some((item) => item.daysOverdue > 0) && <View style={styles.overdueEdge} />}
      <Pressable
        accessible={false}
        onPress={() => openPlantSheet(plant)}
        style={({ pressed }) => pressed && pressedStyle.button}
      >
        <PlantPhoto uri={photoUri(plant.photo)} size={64} />
      </Pressable>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Pressable
            accessibilityRole="button"
            // A one-line name is about 20 pt tall; this makes it a 44 pt target.
            hitSlop={12}
            onPress={() => openPlantSheet(plant)}
            style={({ pressed }) => [styles.grow, pressed && pressedStyle.button]}
          >
            <Text style={text.headline}>{plant.displayName}</Text>
            {scientific && <Text style={styles.scientific}>{scientific}</Text>}
          </Pressable>
          {due.length > 1 && (
            <TextButton
              label="Log all"
              accessibilityLabel={`Log all due care for ${plant.displayName}`}
              onPress={() => onLog(plant, dueTypes)}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More for ${plant.displayName}`}
            // 32 pt across; this makes it a 44 pt target.
            hitSlop={6}
            onPress={() => openPlantSheet(plant)}
            style={({ pressed }) => [styles.more, pressed && pressedStyle.button]}
          >
            <SymbolView name="ellipsis" size={16} weight="bold" tintColor={colors.secondaryLabel} />
          </Pressable>
        </View>
        <Animated.View layout={LinearTransition} style={styles.checklist}>
          {due.map(({ type, daysOverdue }, index) => {
            const overdue = daysOverdue > 0;
            return (
              <Animated.View
                key={type}
                layout={LinearTransition}
                exiting={FadeOut}
                style={[styles.row, index > 0 && group.divider]}
              >
                <CareSymbol type={type} size={20} />
                <View style={styles.grow}>
                  <Text style={styles.rowLabel}>{CARE_COPY[type].label}</Text>
                  <Text style={[styles.status, overdue ? styles.overdue : styles.dueToday]}>
                    {overdue ? `${daysOverdue}d overdue` : 'due today'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${CARE_COPY[type].label} ${plant.displayName}`}
                  // 30 pt across; this makes it a 46 pt target.
                  hitSlop={8}
                  onPress={() => onLog(plant, [type])}
                >
                  {({ pressed }) => (
                    <SymbolView
                      name={pressed ? 'checkmark.circle.fill' : 'circle'}
                      size={30}
                      tintColor={pressed ? colors.tint : colors.tertiaryLabel}
                    />
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function RestOfGarden({ plants }: { plants: PlantCare[] }) {
  return (
    <Animated.View layout={LinearTransition}>
      <Text style={group.header}>Rest of the garden · {plants.length}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.restStrip}
      >
        {plants.map((plant) => (
          <Pressable
            key={plant.id}
            accessibilityRole="button"
            accessibilityLabel={`${plant.displayName}, all good`}
            onPress={() => openPlantSheet(plant)}
            style={({ pressed }) => [styles.restPlant, pressed && styles.restPlantPressed]}
          >
            <PlantPhoto uri={photoUri(plant.photo)} size={56} />
            <Text style={styles.restName} numberOfLines={1}>
              {plant.displayName}
            </Text>
            <Text style={text.caption}>all good</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function UndoToast({ message, onUndo }: { message: string; onUndo: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.toast, { bottom: insets.bottom + space.m }]}>
      <Text style={styles.toastText}>{message}</Text>
      <TextButton label="Undo" onPress={onUndo} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: space.m, paddingBottom: 96 },
  summary: { ...text.subheadline, fontWeight: '600', marginHorizontal: space.xl },
  empty: { alignItems: 'center', gap: space.s, paddingHorizontal: space.xxxl, paddingVertical: 64 },
  emptyAction: { marginTop: space.s },
  hint: { ...text.body, color: colors.secondaryLabel, textAlign: 'center' },
  grow: { flex: 1 },
  card: {
    flexDirection: 'row',
    gap: space.m,
    marginHorizontal: space.l,
    marginTop: space.m,
    padding: space.m,
    borderRadius: 18,
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
  cardBody: { flex: 1, gap: space.s },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  scientific: { ...text.caption, fontStyle: 'italic' },
  more: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  checklist: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.s,
    paddingHorizontal: space.m,
    backgroundColor: colors.fill,
  },
  rowLabel: { ...text.subheadline, fontWeight: '700', color: colors.label },
  status: { ...text.footnote, fontWeight: '700' },
  overdue: { color: colors.danger },
  dueToday: { color: colors.dueToday },
  restStrip: { gap: space.m, paddingHorizontal: space.l, paddingVertical: space.s },
  restPlant: { width: 72, alignItems: 'center', gap: space.xs, opacity: 0.6 },
  restPlantPressed: { opacity: 0.3 },
  restName: { ...text.caption, fontWeight: '600', color: colors.label },
  toast: {
    position: 'absolute',
    left: space.l,
    right: space.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.m,
    paddingHorizontal: space.l,
    borderRadius: 14,
    backgroundColor: colors.floating,
    // Black, iOS's default shadow colour.
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: { ...text.subheadline, flex: 1, fontWeight: '600', color: colors.label },
});
