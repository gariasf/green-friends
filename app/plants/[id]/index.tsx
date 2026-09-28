import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useScrollOffset,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { evaluateCare, plantSeasonOn, type CareStatus } from '@/src/core/care';
import { readCareGuide } from '@/src/core/careGuide';
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
import { CareGroup } from '@/src/ui/CareGuide';
import { guides } from '@/src/ui/guides';
import { EmptyState } from '@/src/ui/EmptyState';
import { TextButton } from '@/src/ui/Form';
import { Icon } from '@/src/ui/Icon';
import { heroDrift, heroStretch, tickHaptic, useHeroEntering } from '@/src/ui/motion';
import {
  coverStyle,
  HERO_HEIGHT,
  photoFiles,
  photoUri,
  PlantPhoto,
  usePhotoPicker,
} from '@/src/ui/Photo';
import {
  accessibilitySize,
  colors,
  font,
  group,
  pressedStyle,
  radius,
  space,
  text,
  useRaised,
} from '@/src/ui/theme';
import { useUndoToast } from '@/src/ui/UndoToast';
import { useAfterWritesOrForeground } from '@/src/ui/useAfterWrites';
import { dayLabel, scientificBeneath, tileLine, tileValue, whoseSchedule } from '@/src/ui/words';

/**
 * A plant's screen, where tapping a plant anywhere leads (spec #22, the prototype's variant B): its
 * photo, which a tap replaces, its names and pet toxicity; a tile per care type with when it's next
 * Due, when it was last done and, once Due, Done; its Care Log as a timeline; its Current Pot and
 * whose schedule it follows. Under the tiles, its Care group (spec #48): how to water, feed and place it
 * in today's Season, its Care Guide and the Symptoms. An Archived plant is out of care, so it has no
 * tiles or Care group and offers Unarchive instead.
 */
export default function PlantScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]'>();
  const plant = usePlant(id);
  const undo = useUndoToast();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Whether the photo has scrolled up under the navigation bar.
  const [pastHero, setPastHero] = useState(false);
  const heroHeight = width * HERO_HEIGHT;
  // The photo drifts as it scrolls up and stretches when pulled down, and the bar's ground fades
  // in over the last of it.
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollOffset(scroll);
  const reduced = useReducedMotion();
  const turn = heroHeight - insets.top - 44;
  const stretchStyle = useAnimatedStyle(() => heroStretch(offset.value, heroHeight, reduced));
  const driftStyle = useAnimatedStyle(() => heroDrift(offset.value, reduced));
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [turn - 48, turn], [0, 1], 'clamp'),
  }));
  // Once the photo has scrolled up under the bar, the bar takes the plant's name, as Apple
  // Music's album pages do. Watched on the UI thread, so JavaScript hears only of the crossing.
  useAnimatedReaction(
    () => offset.value > turn,
    (past, before) => {
      if (past !== before) scheduleOnRN(setPastHero, past);
    },
  );
  const heroEntering = useHeroEntering();
  const photoPicker = usePhotoPicker(({ prepared, focus }) =>
    setPlantPhoto(db, photoFiles, id, prepared, focus),
  );
  if (!plant) return null;

  const { care, events, photo, row, today } = plant;
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);
  const uri = photoUri(photo);
  const lastDone = (type: CareType) => events.find((event) => event.type === type)?.occurredOn;
  const openLog = (type?: CareEventType) =>
    router.push({ pathname: '/plants/[id]/log', params: { id, type } });
  const pickPhoto = photoPicker.choose;
  const badge = plant.toxicToPets !== null && <Toxicity toxic={plant.toxicToPets} />;
  const done = (type: CareType) => {
    const event = logCareEvent(db, { plantId: id, type });
    tickHaptic();
    undo.offer(`${CARE_COPY[type].done} ${plant.displayName}`, [event.id]);
  };
  // Over the photo, the bar's buttons are white; the tint once the photo has passed (spec #84).
  const onPhoto = !!uri && !pastHero;

  return (
    <>
      {photoPicker.framing}
      <Animated.ScrollView
        ref={scroll}
        // With a photo, the photo starts at the screen's top edge, under a clear navigation bar.
        contentInsetAdjustmentBehavior={uri ? 'never' : 'automatic'}
        // No scrollEventThrottle: Reanimated's default of 1 moves the photo every frame; 32 held
        // its drift and stretch to 30 a second under 120 Hz scrolling.
        contentContainerStyle={[styles.content, uri && { paddingBottom: insets.bottom }]}
      >
        <Stack.Screen
          options={{
            headerTransparent: !!uri,
            headerStyle: { backgroundColor: uri ? 'transparent' : colors.background },
            headerBackground: uri
              ? () => (
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: colors.background },
                      barStyle,
                    ]}
                  />
                )
              : undefined,
            title: uri && pastHero ? plant.displayName : '',
            headerTintColor: onPhoto ? colors.onPhoto : undefined,
            headerRight: () => (
              <TextButton
                label="Edit"
                header
                color={onPhoto ? colors.onPhoto : undefined}
                onPress={() => router.push({ pathname: '/plants/[id]/edit', params: { id } })}
              />
            ),
          }}
        />
        {uri ? (
          <>
            <View style={{ height: heroHeight }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Replace photo"
                onPress={pickPhoto}
                style={({ pressed }) => [StyleSheet.absoluteFill, pressed && pressedStyle.button]}
              >
                {/* The outer view stretches when pulled down; the inner clips the photo's drift. */}
                <Animated.View style={[StyleSheet.absoluteFill, stretchStyle]}>
                  <View style={[StyleSheet.absoluteFill, styles.clip]}>
                    <Animated.Image
                      entering={heroEntering}
                      source={{ uri }}
                      style={[coverStyle(plant.focus, width, heroHeight), driftStyle]}
                    />
                  </View>
                </Animated.View>
              </Pressable>
              {/* Over the photo but outside its button, so VoiceOver reads the name as the
                  screen's header, apart from Replace photo. */}
              <View style={styles.scrim}>
                <Text accessibilityRole="header" style={[text.title1, styles.onPhoto]}>
                  {plant.displayName}
                </Text>
                {scientific && (
                  <Text style={[styles.scientific, styles.onPhotoQuiet]}>{scientific}</Text>
                )}
              </View>
            </View>
            {/* Kept without a badge too, or the tiles meet the photo's edge. */}
            <View style={styles.underHero}>{badge}</View>
          </>
        ) : (
          // A plant without a photo: its initial beside its names, which a tap turns into Add photo.
          <View style={styles.compact}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              onPress={pickPhoto}
              style={({ pressed }) => pressed && pressedStyle.button}
            >
              <PlantPhoto uri={null} size={64} name={plant.displayName} />
            </Pressable>
            <View style={styles.names}>
              <Text accessibilityRole="header" style={text.title1}>
                {plant.displayName}
              </Text>
              {scientific && <Text style={styles.scientific}>{scientific}</Text>}
              {badge}
            </View>
          </View>
        )}

        {plant.archivedAt !== null && (
          // In a row, the line wraps into a tall column at accessibility text sizes, so there it stacks.
          <View style={[styles.banner, accessibilitySize(fontScale) && styles.bannerStacked]}>
            <Icon name="archive" size={18} color={colors.secondaryLabel} />
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
                onDone={() => done(type)}
              />
            ))}
          </View>
        )}

        {care && <CareGroup id={id} guide={plant.guide} season={plant.season} today={today} />}

        <View style={styles.logHead}>
          <Text accessibilityRole="header" style={group.section}>
            Care Log
          </Text>
          <TextButton label="Add note" onPress={() => openLog('note')} />
        </View>
        {/* ponytail: renders every Care Event at once; make the screen a FlatList over the Care Log,
          all above it its header, if one ever runs into the thousands. */}
        <View style={styles.timeline}>
          {events.length === 0 && (
            <EmptyState
              symbol="history"
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
      </Animated.ScrollView>
      {undo.toast}
    </>
  );
}

/**
 * The plant as its screen shows it, read again after writes (it spans several tables), on
 * returning to the foreground and at midnight, where the day turns. Deleted from its Edit screen, the
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
    guide: readCareGuide(db, id, today, guides),
    season: plantSeasonOn(db, row.speciesId, today),
  };
}

function Toxicity({ toxic }: { toxic: boolean }) {
  return (
    <View style={[styles.badge, toxic && styles.badgeToxic]}>
      <Text style={[styles.badgeText, toxic && styles.caution]}>
        {toxic ? 'Toxic to pets' : 'Non-toxic to pets'}
      </Text>
    </View>
  );
}

/**
 * One care type at a glance: when it's next Due or how long it has been Overdue, saying which way
 * it counts, then the day it's next Due or, once Due, when it was last done (spec #84). A tap logs
 * it on a day of the user's choosing; once Due, the tile shows Today's circle, a tap logs it today
 * and a long-press picks the day.
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
  const [{ before, value, after }, spoken] = tileValue(status, today);
  const due = status.state === 'due';
  const tone = due && (status.daysOverdue > 0 ? styles.caution : styles.dueToday);
  const line = tileLine(status, lastDone, today);
  const raised = useRaised();
  return (
    <View style={[styles.tile, raised]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${spoken}. ${line}`}
        accessibilityHint={
          due ? 'Logs it as done today. Long-press to pick a day' : 'Logs it on a day you choose'
        }
        onPress={due ? onDone : onOpen}
        onLongPress={due ? onOpen : undefined}
        style={({ pressed }) => [styles.tileBody, pressed && pressedStyle.button]}
      >
        <View style={styles.tileHead}>
          <CareSymbol type={type} size={18} />
          <Text style={text.footnote}>{label}</Text>
        </View>
        <Text style={[styles.tileValue, tone]}>
          {before && <Text style={[styles.unit, tone]}>{before} </Text>}
          {value}
          {after && <Text style={[styles.unit, tone]}> {after}</Text>}
        </Text>
        <View style={styles.tileFoot}>
          <Text style={[text.footnote, styles.grow]}>{line}</Text>
          {due && <Icon name="circle" size={18} color={colors.tertiaryLabel} />}
        </View>
      </Pressable>
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
  content: { paddingBottom: space.xxl },
  grow: { flex: 1 },
  clip: { overflow: 'hidden' },
  // The hero's scrim, under the names at the photo's foot.
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: space.xs,
    paddingHorizontal: space.xl,
    paddingTop: space.xxxl * 3,
    paddingBottom: space.l,
    experimental_backgroundImage: colors.scrim,
  },
  onPhoto: { color: colors.onPhoto },
  onPhotoQuiet: { color: colors.onPhotoQuiet },
  underHero: { paddingHorizontal: space.xl, paddingTop: space.s, paddingBottom: space.m },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.l,
    paddingHorizontal: space.xl,
    paddingTop: space.m,
    paddingBottom: space.l,
  },
  names: { flex: 1, gap: space.xs },
  scientific: { ...text.subheadline, ...font.italic },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    marginTop: space.xs,
    paddingHorizontal: space.s,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  badgeToxic: { backgroundColor: colors.cautionSoft },
  badgeText: { ...text.footnote, ...font.semibold },
  caution: { color: colors.caution },
  dueToday: { color: colors.dueToday },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginHorizontal: space.l,
    marginBottom: space.m,
    // At least the Unarchive button's hitSlop, above and below it.
    padding: space.m,
    borderRadius: radius.surface,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  bannerStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  tiles: { flexDirection: 'row', gap: space.s, paddingHorizontal: space.l },
  tilesStacked: { flexDirection: 'column' },
  tile: { flex: 1, borderRadius: radius.surface, borderCurve: 'continuous' },
  // Grows, so the whole of a tile shorter than its row's tallest is one target.
  tileBody: { flexGrow: 1, gap: space.xs, padding: space.m },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tileValue: { ...text.title2, ...font.bold },
  tileFoot: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  unit: { ...text.subheadline, ...font.semibold, fontSize: 15, color: colors.label },
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
  dot: { width: 12, height: 12, borderRadius: radius.pill, marginTop: space.xs },
  line: { flex: 1, width: 2, marginVertical: 2, backgroundColor: colors.separator },
  entryBody: { flex: 1, paddingBottom: space.l },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, padding: space.xl },
  chip: {
    ...text.subheadline,
    overflow: 'hidden',
    paddingHorizontal: space.m,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
});
