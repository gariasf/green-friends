import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { evaluateCare, type CareStatus } from '@/src/core/care';
import {
  listCareEvents,
  logCareEvent,
  type CareEvent,
  type CareEventType,
} from '@/src/core/careLog';
import { localDay } from '@/src/core/dates';
import { setPlantPhoto } from '@/src/core/photos';
import {
  CARE_TYPES,
  getPlant,
  listArchivedPlants,
  listPlants,
  unarchivePlant,
  type CareType,
} from '@/src/core/plants';
import { getSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { CARE_COPY, CareSymbol } from '@/src/ui/CareEvent';
import { EmptyState } from '@/src/ui/EmptyState';
import { readGuide } from '@/src/proto/careGuide';
import { GuideBody, SummaryCard, SummaryRows } from '@/src/proto/GuideViews';
import { Segmented, TextButton } from '@/src/ui/Form';
import { choosePhoto, photoFiles, photoUri } from '@/src/ui/Photo';
import { accessibilitySize, colors, group, pressedStyle, space, text } from '@/src/ui/theme';
import { PrototypeSwitcher, usePrototypeVariant } from '@/src/ui/PrototypeSwitcher';
import { useUndoToast } from '@/src/ui/UndoToast';
import { useAfterWritesOrForeground } from '@/src/ui/useAfterWrites';
import { dayLabel, lastLine, scientificBeneath, tileValue, whoseSchedule } from '@/src/ui/words';

/**
 * A plant's screen, where tapping a plant anywhere leads (spec #22, the prototype's variant B): its
 * photo, which a tap replaces, its names and pet toxicity; a tile per care type with when it's next
 * Due, when it was last done and, once Due, Done; its Care Log as a timeline; its Current Pot and
 * whose schedule it follows. An Archived plant is out of care, so it has no tiles and offers
 * Unarchive instead.
 */
export default function PlantScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]'>();
  const plant = usePlant(id);
  const undo = useUndoToast();
  const { width, fontScale } = useWindowDimensions();
  // PROTOTYPE (Care Guide): three ways to show it, switched from the purple bar.
  const [variant, setVariant] = usePrototypeVariant('care');
  const [tab, setTab] = useState(0);
  if (!plant) return null;
  const guide = readGuide(id, plant.today);
  const guideTab = variant === 2 && tab === 1;

  const { care, events, photo, row, today } = plant;
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);
  const uri = photoUri(photo);
  const lastDone = (type: CareType) => events.find((event) => event.type === type)?.occurredOn;
  const openLog = (type?: CareEventType) =>
    router.push({ pathname: '/plants/[id]/log', params: { id, type } });

  return (
    <>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Stack.Screen
          options={{
            headerRight: () => (
              <TextButton
                label="Edit"
                header
                onPress={() => router.push({ pathname: '/plants/[id]/edit', params: { id } })}
              />
            ),
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? 'Replace photo' : 'Add photo'}
          onPress={() => choosePhoto((prepared) => setPlantPhoto(db, photoFiles, id, prepared))}
          // A banner: a square photo this wide would fill the screen.
          style={({ pressed }) => [
            styles.hero,
            { height: width * 0.72 },
            pressed && pressedStyle.button,
          ]}
        >
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} />
          ) : (
            <SymbolView name="leaf.fill" size={96} tintColor={colors.tint} />
          )}
        </Pressable>

        <View style={styles.title}>
          <Text accessibilityRole="header" style={text.title1}>
            {plant.displayName}
          </Text>
          {scientific && <Text style={styles.scientific}>{scientific}</Text>}
          {plant.toxicToPets !== null && <Toxicity toxic={plant.toxicToPets} />}
        </View>

        {plant.archivedAt !== null && (
          // In a row, the line wraps into a tall column at accessibility text sizes, so there it stacks.
          <View style={[styles.banner, accessibilitySize(fontScale) && styles.bannerStacked]}>
            <SymbolView
              accessibilityElementsHidden
              name="archivebox"
              size={18}
              tintColor={colors.secondaryLabel}
            />
            <Text style={[text.subheadline, !accessibilitySize(fontScale) && styles.grow]}>
              Archived: out of care, its Care Log kept.
            </Text>
            <TextButton label="Unarchive" onPress={() => unarchivePlant(db, id)} />
          </View>
        )}

        {care && (
          // Three abreast, words break mid-word at accessibility text sizes, so there they stack.
          // ponytail: WhenPicker's font-scale threshold, not a measurement; measure the tiles' words
          // with onLayout if a longer label ever breaks at a standard size.
          <View style={[styles.tiles, accessibilitySize(fontScale) && styles.tilesStacked]}>
            {CARE_TYPES.map((type) => (
              <CareTile
                key={type}
                type={type}
                status={care[type]}
                lastDone={lastDone(type)}
                today={today}
                onOpen={() => openLog(type)}
                onDone={() => {
                  const event = logCareEvent(db, { plantId: id, type });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  undo.offer(`${CARE_COPY[type].done} ${plant.displayName}`, [event.id]);
                }}
              />
            ))}
          </View>
        )}

        {care && variant === 0 && <SummaryRows id={id} guide={guide} />}
        {care && variant === 1 && <SummaryCard id={id} guide={guide} />}

        {variant === 2 ? (
          <View style={styles.tabs}>
            <Segmented options={['Care Log', 'Care Guide']} selected={tab} onChange={setTab} />
          </View>
        ) : null}
        {guideTab && <GuideBody id={id} guide={guide} />}
        <View style={[styles.logHead, guideTab && styles.hidden]}>
          <Text accessibilityRole="header" style={group.header}>
            Care Log
          </Text>
          <TextButton label="Add note" onPress={() => openLog('note')} />
        </View>
        {/* ponytail: renders every Care Event at once; make the screen a FlatList over the Care Log,
          all above it its header, if one ever runs into the thousands. */}
        <View style={[styles.timeline, guideTab && styles.hidden]}>
          {events.length === 0 && (
            <EmptyState
              symbol="clock.arrow.circlepath"
              title="Nothing logged yet"
              line="What you log shows up here, newest first."
              // An Archived plant takes Notes only, which Add note above adds.
              action={care ? { label: 'Log care', onPress: () => openLog() } : undefined}
            />
          )}
          {events.map((event, index) => (
            <TimelineEntry
              key={event.id}
              event={event}
              today={today}
              last={index === events.length - 1}
            />
          ))}
        </View>

        <View style={styles.chips}>
          {row.potSizeCm !== null && <Text style={styles.chip}>{row.potSizeCm} cm pot</Text>}
          {row.soil !== null && <Text style={styles.chip}>{row.soil}</Text>}
          <Text style={styles.chip}>{whoseSchedule(row)}</Text>
        </View>
      </ScrollView>
      {undo.toast}
      <PrototypeSwitcher
        labels={['Rows under the tiles', 'One card', 'Guide beside the Log']}
        index={variant}
        onChange={setVariant}
      />
    </>
  );
}

/**
 * The plant as its screen shows it, read again after writes (it spans several tables) and on
 * returning to the foreground, where the day may have turned. Deleted from its Edit screen, the
 * plant is gone once Edit has closed, and this screen closes too, showing the plant as it was
 * rather than going blank.
 */
function usePlant(id: string) {
  const [plant, setPlant] = useState(() => readPlant(id));
  useAfterWritesOrForeground(
    useCallback(() => {
      const next = readPlant(id);
      if (next) setPlant(next);
      else router.back();
    }, [id]),
  );
  return plant;
}

/** Null once the plant is Deleted. Its care is as of `today`, the day it was read. */
function readPlant(id: string) {
  // ponytail: reads the whole garden to find one plant; fine at dozens of plants, a core read of
  // one plant by id at hundreds.
  const listed = [...listPlants(db), ...listArchivedPlants(db)].find(
    (candidate) => candidate.id === id,
  );
  if (!listed) return null;
  const row = getPlant(db, id);
  const today = localDay(new Date());
  return {
    ...listed,
    row,
    today,
    toxicToPets: row.speciesId ? (getSpecies(db, row.speciesId)?.toxicToPets ?? null) : null,
    // Archived plants are out of care, so evaluateCare leaves them out.
    care: evaluateCare(db, today).find((candidate) => candidate.id === id)?.care ?? null,
    events: listCareEvents(db, id),
  };
}

function Toxicity({ toxic }: { toxic: boolean }) {
  return (
    <View style={[styles.badge, toxic && styles.badgeToxic]}>
      <SymbolView
        accessibilityElementsHidden
        name="pawprint.fill"
        size={12}
        tintColor={toxic ? colors.caution : colors.secondaryLabel}
      />
      <Text style={[styles.badgeText, toxic && styles.caution]}>
        {toxic ? 'Toxic to pets' : 'Non-toxic to pets'}
      </Text>
    </View>
  );
}

/**
 * One care type at a glance: when it's next Due or how long it has been Overdue, and when it was
 * last done. A tap logs it on a day of the user's choosing; once Due, Done logs it today.
 */
function CareTile({
  type,
  status,
  lastDone,
  today,
  onOpen,
  onDone,
}: {
  type: CareType;
  status: CareStatus;
  lastDone: string | undefined;
  today: string;
  onOpen: () => void;
  onDone: () => void;
}) {
  const { label } = CARE_COPY[type];
  const [value, spoken] = tileValue(status, today);
  const due = status.state === 'due';
  const overdue = due && status.daysOverdue > 0;
  const last = lastLine(lastDone, today);
  return (
    <View style={styles.tile}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${spoken}. ${last}`}
        accessibilityHint="Logs it on a day you choose"
        onPress={onOpen}
        style={({ pressed }) => [styles.tileBody, pressed && pressedStyle.button]}
      >
        <View style={styles.tileHead}>
          <CareSymbol type={type} size={18} />
          <Text style={text.footnote}>{label}</Text>
        </View>
        <Text style={[text.title2, due && (overdue ? styles.caution : styles.dueToday)]}>
          {value}
          {overdue && <Text style={styles.overdueWord}> overdue</Text>}
        </Text>
        <Text style={text.caption}>{last}</Text>
      </Pressable>
      {due && (
        <Pressable
          accessibilityRole="button"
          // Starts with the word it shows, so Voice Control's "Tap Done" finds it.
          accessibilityLabel={`Done, ${CARE_COPY[type].done.toLowerCase()}`}
          accessibilityHint="Logs it as done today"
          // 26 pt tall; this makes it a 44 pt target.
          hitSlop={{ top: 9, bottom: 9 }}
          onPress={onDone}
          style={({ pressed }) => [styles.done, pressed && pressedStyle.button]}
        >
          <SymbolView name="checkmark" size={12} weight="bold" tintColor={colors.onTint} />
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      )}
    </View>
  );
}

/** A Care Event on the timeline, a dot in its hue; a tap opens it to be edited or deleted. */
function TimelineEntry({ event, today, last }: { event: CareEvent; today: string; last: boolean }) {
  const copy = CARE_COPY[event.type];
  const day = dayLabel(event.occurredOn, today);
  const detail = [event.potSizeCm !== null && `${event.potSizeCm} cm pot`, event.soil, event.note]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[copy.done, day, detail].filter(Boolean).join(', ')}
      accessibilityHint="Edit or delete"
      onPress={() => router.push({ pathname: '/care-events/[id]', params: { id: event.id } })}
      style={({ pressed }) => [styles.entry, pressed && pressedStyle.button]}
    >
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: copy.hue }]} />
        {!last && <View style={styles.line} />}
      </View>
      <View style={styles.entryBody}>
        <Text style={text.footnote}>{day}</Text>
        <Text style={text.headline}>{copy.done}</Text>
        {detail ? <Text style={text.subheadline}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl * 3 },
  tabs: { marginTop: space.xxl, marginHorizontal: space.l },
  hidden: { display: 'none' },
  grow: { flex: 1 },
  hero: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tintSoft },
  title: { gap: space.xs, padding: space.xl, paddingBottom: space.m },
  scientific: { ...text.subheadline, fontStyle: 'italic' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    marginTop: space.xs,
    paddingHorizontal: space.s,
    paddingVertical: space.xs,
    borderRadius: 12,
    backgroundColor: colors.fill,
  },
  badgeToxic: { backgroundColor: colors.cautionSoft },
  badgeText: { ...text.footnote, fontWeight: '600' },
  caution: { color: colors.caution },
  overdueWord: { ...text.footnote, fontWeight: '600', color: colors.caution },
  dueToday: { color: colors.dueToday },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginHorizontal: space.l,
    marginBottom: space.m,
    // At least the Unarchive button's hitSlop, above and below it.
    padding: space.m,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  bannerStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  tiles: { flexDirection: 'row', gap: space.s, paddingHorizontal: space.l },
  tilesStacked: { flexDirection: 'column' },
  tile: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  // Grows, so the whole of a tile shorter than its row's tallest is one target.
  tileBody: { flexGrow: 1, gap: space.xs, padding: space.m },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginHorizontal: space.m,
    marginBottom: space.m,
    paddingVertical: space.xs,
    borderRadius: 10,
    backgroundColor: colors.tint,
  },
  doneLabel: { ...text.subheadline, fontWeight: '600', color: colors.onTint },
  logHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xxl,
    marginBottom: space.m,
    marginHorizontal: space.xl,
  },
  timeline: { paddingHorizontal: space.xl },
  entry: { flexDirection: 'row', gap: space.m },
  rail: { alignItems: 'center', width: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: space.xs },
  line: { flex: 1, width: 2, marginVertical: 2, backgroundColor: colors.separator },
  entryBody: { flex: 1, paddingBottom: space.l },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, padding: space.xl },
  chip: {
    ...text.subheadline,
    overflow: 'hidden',
    paddingHorizontal: space.m,
    paddingVertical: space.xs,
    borderRadius: 14,
    backgroundColor: colors.fill,
  },
});
