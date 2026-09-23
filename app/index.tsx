import { addDatabaseChangeListener } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { evaluateCare, needsAttention, type PlantCare } from '@/src/core/care';
import { deleteCareEvent, logCareEvent } from '@/src/core/careLog';
import { CARE_TYPES, type CareType } from '@/src/core/plants';
import { db } from '@/src/db/client';

/** How each care type reads on a checklist row and in the undo toast. */
const CARE: Record<CareType, { icon: string; label: string; done: string }> = {
  water: { icon: '💧', label: 'Water', done: 'Watered' },
  fertilize: { icon: '✨', label: 'Fertilize', done: 'Fertilized' },
  repot: { icon: '🪨', label: 'Repot', done: 'Repotted' },
};

const UNDO_MS = 4000;

type Undo = { message: string; eventIds: string[] };

/**
 * Today (spec #8, prototype #6): one card per plant that Needs Attention, most Overdue first, with
 * a checklist row per Due care type that logs it as done today in one tap; the rest of the garden
 * dimmed below.
 */
export default function TodayScreen() {
  const [garden, refresh] = useGardenCare();
  const [undo, setUndo] = useState<Undo | null>(null);

  useEffect(() => {
    if (!undo) return;
    AccessibilityInfo.announceForAccessibility(`${undo.message}. Undo available.`);
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const log = (plant: PlantCare, types: CareType[]) => {
    const eventIds = types.map((type) => logCareEvent(db, { plantId: plant.id, type }).id);
    refresh();
    setUndo({
      message:
        types.length === 1
          ? `${CARE[types[0]].done} ${plant.displayName}`
          : `Logged everything for ${plant.displayName}`,
      eventIds,
    });
  };

  const revert = ({ eventIds }: Undo) => {
    for (const id of eventIds) deleteCareEvent(db, id);
    refresh();
    setUndo(null);
  };

  const due = garden.filter(needsAttention);
  const rest = garden.filter((plant) => !needsAttention(plant));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {due.length > 0 ? (
          <>
            <Text style={styles.summary}>
              {due.length === 1 ? '1 plant needs you' : `${due.length} plants need you`}
            </Text>
            {due.map((plant) => (
              <CareCard key={plant.id} plant={plant} onLog={log} />
            ))}
          </>
        ) : (
          <View style={styles.caughtUp}>
            <Text style={styles.caughtUpIcon}>🌿</Text>
            <Text style={styles.title}>All caught up</Text>
            <Text style={styles.hint}>
              {garden.length > 0
                ? 'Nothing needs you today.'
                : 'Add your first plant from the Garden.'}
            </Text>
          </View>
        )}
        {rest.length > 0 && <RestOfGarden plants={rest} />}
      </ScrollView>
      {undo && <UndoToast message={undo.message} onUndo={() => revert(undo)} />}
    </View>
  );
}

/**
 * Every plant's care state for today, re-evaluated on each write (due-ness derives from several
 * tables, and useLiveQuery re-runs on one) and on returning to the foreground, where the day may
 * have turned. `refresh` animates the change, so a logged row folds away instead of jumping.
 */
function useGardenCare() {
  const [garden, setGarden] = useState(() => evaluateCare(db));
  const refresh = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setGarden(evaluateCare(db));
  }, []);
  useEffect(() => {
    // ponytail: left open across midnight, Today shows yesterday until the next write or
    // foregrounding; add a timer for the next local midnight if that ever matters.
    const writes = addDatabaseChangeListener(refresh);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      writes.remove();
      foreground.remove();
    };
  }, [refresh]);
  return [garden, refresh] as const;
}

function CareCard({
  plant,
  onLog,
}: {
  plant: PlantCare;
  onLog: (plant: PlantCare, types: CareType[]) => void;
}) {
  const due = CARE_TYPES.flatMap((type) => {
    const status = plant.care[type];
    return status.state === 'due' ? [{ type, daysOverdue: status.daysOverdue }] : [];
  });
  const dueTypes = due.map((item) => item.type);

  return (
    <View style={styles.card}>
      {due.some((item) => item.daysOverdue > 0) && <View style={styles.overdueEdge} />}
      <PhotoSlot size={64} />
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <View style={styles.grow}>
            <Text style={styles.name}>{plant.displayName}</Text>
            {plant.scientificName && <Text style={styles.scientific}>{plant.scientificName}</Text>}
          </View>
          {due.length > 1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Log all due care for ${plant.displayName}`}
              hitSlop={8}
              onPress={() => onLog(plant, dueTypes)}
            >
              <Text style={styles.all}>✓ All</Text>
            </Pressable>
          )}
          {/* Opens the plant sheet once that lands (#14); shown, inert, until then. */}
          <Pressable
            disabled
            accessibilityRole="button"
            accessibilityLabel={`More for ${plant.displayName}`}
            style={styles.more}
          >
            <Text style={styles.moreText}>⋯</Text>
          </Pressable>
        </View>
        <View style={styles.checklist}>
          {due.map(({ type, daysOverdue }, index) => (
            <View key={type} style={[styles.row, index > 0 && styles.rowDivider]}>
              <View style={styles.grow}>
                <Text style={styles.rowLabel}>
                  {CARE[type].icon} {CARE[type].label}
                </Text>
                <Text style={[styles.status, daysOverdue > 0 ? styles.overdue : styles.dueToday]}>
                  {daysOverdue > 0 ? `${daysOverdue}d overdue` : 'due today'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${CARE[type].label} ${plant.displayName}`}
                hitSlop={8}
                onPress={() => onLog(plant, [type])}
                style={({ pressed }) => [styles.check, pressed && styles.checkPressed]}
              >
                {({ pressed }) => (
                  <Text style={[styles.checkMark, pressed && styles.checkMarkPressed]}>✓</Text>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function RestOfGarden({ plants }: { plants: PlantCare[] }) {
  return (
    <>
      <Text style={styles.restHeading}>Rest of the garden · {plants.length}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.restStrip}
      >
        {plants.map((plant) => (
          <View
            key={plant.id}
            accessible
            accessibilityLabel={`${plant.displayName}, all good`}
            style={styles.restPlant}
          >
            <PhotoSlot size={56} />
            <Text style={styles.restName} numberOfLines={1}>
              {plant.displayName}
            </Text>
            <Text style={styles.hintSmall}>all good</Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

/** Where the plant's photo goes; a placeholder until photos land (#15). */
function PhotoSlot({ size }: { size: number }) {
  return (
    <View accessibilityElementsHidden style={[styles.photo, { width: size, height: size }]}>
      <Text style={{ fontSize: size / 2 }}>🪴</Text>
    </View>
  );
}

function UndoToast({ message, onUndo }: { message: string; onUndo: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.toast, { bottom: insets.bottom + 12 }]}>
      <Text style={styles.toastText}>{message}</Text>
      <Pressable accessibilityRole="button" hitSlop={12} onPress={onUndo}>
        <Text style={styles.toastUndo}>Undo</Text>
      </Pressable>
    </View>
  );
}

const RED = '#e0342b';
const AMBER = '#c96a00';
const GREEN = '#2e7d32';
const SEPARATOR = '#e4e4e9';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f2f7' },
  content: { paddingTop: 12, paddingBottom: 96 },
  summary: { marginHorizontal: 20, fontSize: 14, fontWeight: '600', color: '#666' },
  caughtUp: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 64, gap: 8 },
  caughtUpIcon: { fontSize: 56 },
  title: { fontSize: 22, fontWeight: '600' },
  hint: { fontSize: 16, color: '#666', textAlign: 'center' },
  hintSmall: { fontSize: 11, color: '#666' },
  grow: { flex: 1 },
  card: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  overdueEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: RED },
  photo: {
    borderRadius: 14,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 17, fontWeight: '700' },
  scientific: { fontSize: 12, fontStyle: 'italic', color: '#666' },
  all: { fontSize: 14, fontWeight: '700', color: GREEN, paddingVertical: 4 },
  more: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SEPARATOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { fontSize: 15, fontWeight: '800', color: '#666' },
  checklist: { borderWidth: 1, borderColor: SEPARATOR, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: '#f7f7fa',
  },
  rowDivider: { borderTopWidth: 1, borderColor: SEPARATOR },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  status: { fontSize: 13, fontWeight: '700' },
  overdue: { color: RED },
  dueToday: { color: AMBER },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#aeaeb5',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPressed: { backgroundColor: GREEN, borderColor: GREEN },
  checkMark: { fontSize: 16, fontWeight: '800', color: 'transparent' },
  checkMarkPressed: { color: '#fff' },
  restHeading: {
    marginTop: 24,
    marginHorizontal: 20,
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  restStrip: { gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  restPlant: { width: 72, alignItems: 'center', gap: 2, opacity: 0.6 },
  restName: { fontSize: 12, fontWeight: '600' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#1c1c22',
  },
  toastText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  toastUndo: { color: '#81c784', fontSize: 15, fontWeight: '800' },
});
