import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  DynamicColorIOS,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { evaluateCare, type CareStatus } from '@/src/core/care';
import { listCareEvents, logCareEvent, type CareEvent } from '@/src/core/careLog';
import { daysBetween, localDay } from '@/src/core/dates';
import { setPlantPhoto } from '@/src/core/photos';
import {
  CARE_TYPES,
  getDisplayName,
  getPlant,
  hasOverride,
  listArchivedPlants,
  unarchivePlant,
  type CareType,
  type Plant,
} from '@/src/core/plants';
import { getSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import {
  CARE_COPY,
  careStatus,
  dayLabel,
  describeSchedule,
  lastDone,
  shortDay,
} from '@/src/ui/CareEvent';
import { alertError, PrimaryButton, TextButton } from '@/src/ui/Form';
import { PlantPhoto, photoFiles, photoUri, pickPhoto } from '@/src/ui/Photo';
import { scientificBeneath } from '@/src/ui/PlantRow';
import { PrototypeSwitcher, usePrototypeVariant } from '@/src/ui/PrototypeSwitcher';
import { colors, group, space, text } from '@/src/ui/theme';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

/**
 * PROTOTYPE (UI pass): the Plant screen, where tapping a plant anywhere leads. Three structurally
 * different variants on this one route, switched from the purple bar at the bottom:
 * A · Grouped list, B · Hero + tiles, C · Up next. Same data, same actions; only the layout and
 * the primary affordance differ.
 */
export default function PlantScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]'>();
  const [detail, refresh] = usePlantDetail(id);
  const [variant, setVariant] = usePrototypeVariant('plant');
  // Deleted from its Edit screen, which has closed: this screen goes too.
  useEffect(() => {
    if (!detail) router.back();
  }, [detail]);
  if (!detail) return null;

  const actions: Actions = {
    logNow: (type) => {
      logCareEvent(db, { plantId: id, type });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
    },
    openLog: (type) => router.push({ pathname: '/plants/[id]/log', params: { id, type } }),
    openEvent: (event) => router.push({ pathname: '/care-events/[id]', params: { id: event.id } }),
    changePhoto: async () => {
      try {
        const prepared = await pickPhoto();
        if (prepared) setPlantPhoto(db, photoFiles, id, prepared);
      } catch (error) {
        alertError('Could not add the photo', error);
      }
    },
    unarchive: () => unarchivePlant(db, id),
  };
  const Variant = [VariantA, VariantB, VariantC][variant];

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TextButton
              label="Edit"
              onPress={() => router.push({ pathname: '/plants/[id]/edit', params: { id } })}
            />
          ),
        }}
      />
      <Variant d={detail} a={actions} />
      <PrototypeSwitcher
        labels={['Grouped list', 'Hero + tiles', 'Up next']}
        index={variant}
        onChange={setVariant}
      />
    </>
  );
}

type Actions = {
  logNow: (type: CareType) => void;
  openLog: (type: CareType | 'note') => void;
  openEvent: (event: CareEvent) => void;
  changePhoto: () => void;
  unarchive: () => void;
};

type Detail = {
  plant: Plant;
  name: string;
  scientific: string | null;
  toxic: boolean | null;
  photo: string | null;
  /** Null for an Archived plant, which is out of care. */
  care: Record<CareType, CareStatus> | null;
  schedule: Record<CareType, { text: string; own: boolean }>;
  last: Partial<Record<CareType, string>>;
  events: CareEvent[];
  today: string;
};

/** Everything the Plant screen shows, read again after every write. */
function usePlantDetail(id: string) {
  const [detail, setDetail] = useState(() => readDetail(id));
  const refresh = useCallback(() => setDetail(readDetail(id)), [id]);
  useAfterWrites(refresh);
  return [detail, refresh] as const;
}

function readDetail(id: string): Detail | null {
  let plant: Plant;
  try {
    plant = getPlant(db, id);
  } catch {
    // Deleted from its Edit screen: the screen closes with it.
    return null;
  }
  const species = plant.speciesId ? getSpecies(db, plant.speciesId) : null;
  const inCare = evaluateCare(db).find((candidate) => candidate.id === id) ?? null;
  const listed = inCare ?? listArchivedPlants(db).find((candidate) => candidate.id === id);
  const events = listCareEvents(db, id);
  const last: Partial<Record<CareType, string>> = {};
  for (const event of events) {
    if (event.type !== 'note' && !last[event.type]) last[event.type] = event.occurredOn;
  }
  const name = getDisplayName(db, id);
  const schedule = {} as Detail['schedule'];
  for (const type of CARE_TYPES) {
    const own = hasOverride(plant, type);
    schedule[type] = { own, text: describeSchedule(type, own ? plant : species) };
  }
  return {
    plant,
    name,
    scientific: scientificBeneath(name, species?.scientificName ?? null),
    toxic: species?.toxicToPets ?? null,
    photo: listed?.photo ?? null,
    care: inCare?.care ?? null,
    schedule,
    last,
    events,
    today: localDay(new Date()),
  };
}

// ——— Shared bits ———————————————————————————————————————————————————————————————

const toxicBackground = DynamicColorIOS({ light: '#fdecea', dark: '#3b1d1b' });

function Toxicity({ value, centered = false }: { value: boolean | null; centered?: boolean }) {
  if (value === null) return null;
  return (
    <View
      style={[
        shared.badge,
        centered && shared.badgeCentered,
        value ? shared.badgeToxic : shared.badgeSafe,
      ]}
    >
      <SymbolView
        name="pawprint.fill"
        size={12}
        tintColor={value ? colors.overdue : colors.secondaryLabel}
      />
      <Text style={[shared.badgeText, { color: value ? colors.overdue : colors.secondaryLabel }]}>
        {value ? 'Toxic to pets' : 'Non-toxic to pets'}
      </Text>
    </View>
  );
}

function ArchivedBanner({ onUnarchive }: { onUnarchive: () => void }) {
  return (
    <View style={[group.box, shared.banner]}>
      <SymbolView name="archivebox" size={18} tintColor={colors.secondaryLabel} />
      <Text style={[text.subheadline, shared.grow]}>Archived: out of care, history kept.</Text>
      <TextButton label="Unarchive" onPress={onUnarchive} />
    </View>
  );
}

function CheckButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress}>
      <SymbolView name="circle" size={28} tintColor={colors.tertiaryLabel} />
    </Pressable>
  );
}

function eventDetail(event: CareEvent): string {
  return [event.potSizeCm !== null && `${event.potSizeCm} cm pot`, event.soil, event.note]
    .filter(Boolean)
    .join(' · ');
}

const isDue = (status: CareStatus | undefined) => status?.state === 'due';

// ——— A · Grouped list ——————————————————————————————————————————————————————————

function VariantA({ d, a }: { d: Detail; a: Actions }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}
    >
      <View style={A.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change photo"
          onPress={a.changePhoto}
        >
          <PlantPhoto uri={photoUri(d.photo)} size={112} radius={28} />
          <View style={A.camera}>
            <SymbolView name="camera.fill" size={13} tintColor={colors.onTint} />
          </View>
        </Pressable>
        <Text style={[text.title1, shared.centered]}>{d.name}</Text>
        {d.scientific && <Text style={shared.scientific}>{d.scientific}</Text>}
        <Toxicity value={d.toxic} centered />
      </View>

      {d.plant.archivedAt && <ArchivedBanner onUnarchive={a.unarchive} />}

      {d.care && (
        <>
          <Text style={[text.sectionHeader, group.header]}>Care</Text>
          <View style={group.box}>
            {CARE_TYPES.map((type, index) => {
              const status = careStatus(d.care![type], d.today);
              return (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityHint={`Log ${CARE_COPY[type].label.toLowerCase()} on a day you choose`}
                  onPress={() => a.openLog(type)}
                  style={({ pressed }) => [
                    group.row,
                    index > 0 && group.divider,
                    pressed && shared.pressedRow,
                  ]}
                >
                  <SymbolView
                    name={CARE_COPY[type].symbol}
                    size={20}
                    tintColor={CARE_COPY[type].hue}
                  />
                  <View style={shared.grow}>
                    <Text style={text.body}>{CARE_COPY[type].label}</Text>
                    <Text style={text.footnote}>{lastDone(type, d.last[type], d.today)}</Text>
                  </View>
                  <Text style={[A.status, { color: status.color }]}>{status.text}</Text>
                  {isDue(d.care![type]) && (
                    <CheckButton
                      label={`${CARE_COPY[type].label}, done today`}
                      onPress={() => a.logNow(type)}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <View style={[group.header, A.sectionRow]}>
        <Text style={text.sectionHeader}>Care Log</Text>
        <TextButton label="Add note" onPress={() => a.openLog('note')} />
      </View>
      <View style={group.box}>
        {d.events.length === 0 ? (
          <Text style={[text.subheadline, A.emptyLog]}>Nothing logged yet.</Text>
        ) : (
          d.events.map((event, index) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityHint="Edit or delete"
              onPress={() => a.openEvent(event)}
              style={({ pressed }) => [
                group.row,
                index > 0 && group.divider,
                pressed && shared.pressedRow,
              ]}
            >
              <SymbolView
                name={CARE_COPY[event.type].symbol}
                size={18}
                tintColor={CARE_COPY[event.type].hue}
              />
              <View style={shared.grow}>
                <Text style={text.body}>{CARE_COPY[event.type].done}</Text>
                {eventDetail(event) !== '' && (
                  <Text style={text.footnote} numberOfLines={2}>
                    {eventDetail(event)}
                  </Text>
                )}
              </View>
              <Text style={text.subheadline}>{dayLabel(event.occurredOn, d.today)}</Text>
            </Pressable>
          ))
        )}
      </View>

      <Text style={[text.sectionHeader, group.header]}>About</Text>
      <View style={group.box}>
        <Info
          label="Pot"
          value={d.plant.potSizeCm !== null ? `${d.plant.potSizeCm} cm` : 'Not set'}
          first
        />
        <Info label="Soil" value={d.plant.soil ?? 'Not set'} />
        {CARE_TYPES.map((type) => (
          <Info
            key={type}
            label={CARE_COPY[type].label}
            value={`${d.schedule[type].text}${d.schedule[type].own ? ' · own' : ''}`}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function Info({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[group.row, !first && group.divider]}>
      <Text style={text.body}>{label}</Text>
      <Text style={[text.body, A.infoValue]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const A = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.xl,
    paddingTop: space.s,
  },
  camera: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
    borderWidth: 2,
    borderColor: colors.background,
  },
  status: { fontSize: 15, fontWeight: '500' },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  emptyLog: { padding: space.l },
  infoValue: { flex: 1, textAlign: 'right', color: colors.secondaryLabel },
});

// ——— B · Hero + tiles ——————————————————————————————————————————————————————————

function tileValue(status: CareStatus, today: string): string {
  switch (status.state) {
    case 'unscheduled':
      return '—';
    case 'paused':
      return 'Paused';
    case 'due':
      return status.daysOverdue === 0 ? 'Today' : `${status.daysOverdue}d late`;
    case 'upcoming': {
      const days = daysBetween(today, status.dueOn);
      return days < 60 ? `${days}d` : `${Math.round(days / 30.4)}mo`;
    }
  }
}

function VariantB({ d, a }: { d: Detail; a: Actions }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change photo"
        onPress={a.changePhoto}
        style={[B.hero, { height: width * 0.72 }]}
      >
        {d.photo ? (
          <Image source={{ uri: photoUri(d.photo)! }} style={StyleSheet.absoluteFill} />
        ) : (
          <SymbolView name="leaf.fill" size={96} tintColor={colors.tint} />
        )}
      </Pressable>
      <View style={B.title}>
        <Text style={text.title1}>{d.name}</Text>
        {d.scientific && <Text style={shared.scientificLeft}>{d.scientific}</Text>}
        <Toxicity value={d.toxic} />
      </View>

      {d.plant.archivedAt && <ArchivedBanner onUnarchive={a.unarchive} />}

      {d.care && (
        <View style={B.tiles}>
          {CARE_TYPES.map((type) => {
            const status = d.care![type];
            const due = isDue(status);
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={`${CARE_COPY[type].label}, ${careStatus(status, d.today).text}`}
                onPress={() => a.openLog(type)}
                style={({ pressed }) => [
                  B.tile,
                  due && { borderColor: careStatus(status, d.today).color },
                  pressed && shared.pressed,
                ]}
              >
                <View style={B.tileHead}>
                  <SymbolView
                    name={CARE_COPY[type].symbol}
                    size={18}
                    tintColor={CARE_COPY[type].hue}
                  />
                  <Text style={text.footnote}>{CARE_COPY[type].label}</Text>
                </View>
                <Text style={[B.tileValue, due && { color: careStatus(status, d.today).color }]}>
                  {tileValue(status, d.today)}
                </Text>
                <Text style={text.caption} numberOfLines={2}>
                  {d.last[type] ? `Last ${shortDay(d.last[type]!, d.today)}` : 'Never logged'}
                </Text>
                {due && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${CARE_COPY[type].label}, done today`}
                    onPress={() => a.logNow(type)}
                    style={({ pressed }) => [B.done, pressed && shared.pressed]}
                  >
                    <SymbolView
                      name="checkmark"
                      size={12}
                      weight="bold"
                      tintColor={colors.onTint}
                    />
                    <Text style={B.doneText}>Done</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={[group.header, B.sectionRow]}>
        <Text style={text.sectionHeader}>History</Text>
        <TextButton label="Add note" onPress={() => a.openLog('note')} />
      </View>
      <View style={B.timeline}>
        {d.events.length === 0 && <Text style={text.subheadline}>Nothing logged yet.</Text>}
        {d.events.map((event, index) => (
          <Pressable
            key={event.id}
            accessibilityRole="button"
            onPress={() => a.openEvent(event)}
            style={({ pressed }) => [B.entry, pressed && shared.pressed]}
          >
            <View style={B.rail}>
              <View style={[B.dot, { backgroundColor: CARE_COPY[event.type].hue }]} />
              {index < d.events.length - 1 && <View style={B.line} />}
            </View>
            <View style={[shared.grow, B.entryBody]}>
              <Text style={text.footnote}>{dayLabel(event.occurredOn, d.today)}</Text>
              <Text style={text.headline}>{CARE_COPY[event.type].done}</Text>
              {eventDetail(event) !== '' && (
                <Text style={text.subheadline}>{eventDetail(event)}</Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>

      <View style={B.chips}>
        {d.plant.potSizeCm !== null && <Text style={B.chip}>{d.plant.potSizeCm} cm pot</Text>}
        {d.plant.soil && <Text style={B.chip}>{d.plant.soil}</Text>}
        <Text style={B.chip}>
          {CARE_TYPES.some((type) => d.schedule[type].own) ? 'Own schedule' : 'Species schedule'}
        </Text>
      </View>
    </ScrollView>
  );
}

const B = StyleSheet.create({
  hero: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tintSoft },
  title: { gap: space.xs + 2, padding: space.xl, paddingBottom: space.m },
  tiles: { flexDirection: 'row', gap: space.s, paddingHorizontal: space.l },
  tile: {
    flex: 1,
    gap: space.xs,
    padding: space.m,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  tileValue: { fontSize: 24, fontWeight: '700', color: colors.label },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.xs,
    paddingVertical: space.xs + 2,
    borderRadius: 10,
    backgroundColor: colors.tint,
  },
  doneText: { fontSize: 14, fontWeight: '700', color: colors.onTint },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  timeline: { paddingHorizontal: space.xl },
  entry: { flexDirection: 'row', gap: space.m },
  rail: { alignItems: 'center', width: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: colors.separator, marginVertical: 2 },
  entryBody: { paddingBottom: space.l, gap: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, padding: space.xl },
  chip: {
    overflow: 'hidden',
    paddingHorizontal: space.m,
    paddingVertical: space.xs + 2,
    borderRadius: 14,
    backgroundColor: colors.fill,
    fontSize: 14,
    color: colors.secondaryLabel,
  },
});

// ——— C · Up next ————————————————————————————————————————————————————————————————

function whenColumn(status: CareStatus, today: string): string {
  switch (status.state) {
    case 'due':
      return 'Today';
    case 'paused':
      return 'Paused';
    case 'unscheduled':
      return '—';
    case 'upcoming': {
      const [year, month, date] = status.dueOn.split('-').map(Number);
      return new Date(year, month - 1, date, 12).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: status.dueOn.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
      });
    }
  }
}

/** Upcoming care soonest first; Paused and unscheduled last. */
function agenda(care: Record<CareType, CareStatus>) {
  const rank = (status: CareStatus) =>
    status.state === 'due' || status.state === 'upcoming'
      ? status.dueOn
      : status.state === 'paused'
        ? '9998'
        : '9999';
  return [...CARE_TYPES].sort((a, b) => rank(care[a]).localeCompare(rank(care[b])));
}

function byMonth(events: CareEvent[]) {
  const months: { title: string; events: CareEvent[] }[] = [];
  for (const event of events) {
    const [year, month] = event.occurredOn.split('-').map(Number);
    const title = new Date(year, month - 1, 1, 12).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    if (months.at(-1)?.title !== title) months.push({ title, events: [] });
    months.at(-1)!.events.push(event);
  }
  return months;
}

function VariantC({ d, a }: { d: Detail; a: Actions }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={shared.grow}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
      >
        <View style={C.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change photo"
            onPress={a.changePhoto}
          >
            <PlantPhoto uri={photoUri(d.photo)} size={72} />
          </Pressable>
          <View style={[shared.grow, C.headerText]}>
            <Text style={text.title2}>{d.name}</Text>
            {d.scientific && <Text style={shared.scientificLeft}>{d.scientific}</Text>}
            <Toxicity value={d.toxic} />
          </View>
        </View>

        {d.plant.archivedAt && <ArchivedBanner onUnarchive={a.unarchive} />}

        {d.care && (
          <>
            <Text style={[text.sectionHeader, group.header]}>Up next</Text>
            <View style={group.box}>
              {agenda(d.care).map((type, index) => {
                const status = careStatus(d.care![type], d.today);
                return (
                  <View key={type} style={[group.row, index > 0 && group.divider]}>
                    <Text style={[C.when, isDue(d.care![type]) && { color: status.color }]}>
                      {whenColumn(d.care![type], d.today)}
                    </Text>
                    <SymbolView
                      name={CARE_COPY[type].symbol}
                      size={18}
                      tintColor={CARE_COPY[type].hue}
                    />
                    <View style={shared.grow}>
                      <Text style={text.body}>{CARE_COPY[type].label}</Text>
                      <Text style={[text.footnote, { color: status.color }]}>{status.text}</Text>
                    </View>
                    {isDue(d.care![type]) && (
                      <CheckButton
                        label={`${CARE_COPY[type].label}, done today`}
                        onPress={() => a.logNow(type)}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {byMonth(d.events).map((month) => (
          <View key={month.title}>
            <Text style={[text.sectionHeader, group.header]}>{month.title}</Text>
            <View style={group.box}>
              {month.events.map((event, index) => (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  onPress={() => a.openEvent(event)}
                  style={({ pressed }) => [
                    group.row,
                    index > 0 && group.divider,
                    pressed && shared.pressedRow,
                  ]}
                >
                  <Text style={C.dayNumber}>{Number(event.occurredOn.slice(8))}</Text>
                  <View style={shared.grow}>
                    <Text style={text.body}>{CARE_COPY[event.type].done}</Text>
                    {eventDetail(event) !== '' && (
                      <Text style={text.footnote} numberOfLines={2}>
                        {eventDetail(event)}
                      </Text>
                    )}
                  </View>
                  <SymbolView
                    name={CARE_COPY[event.type].symbol}
                    size={16}
                    tintColor={CARE_COPY[event.type].hue}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {d.events.length === 0 && (
          <Text style={[text.subheadline, C.nothing]}>Nothing logged yet.</Text>
        )}

        <Text style={[text.footnote, C.about]}>
          {[
            d.plant.potSizeCm !== null && `In a ${d.plant.potSizeCm} cm pot`,
            d.plant.soil && `soil: ${d.plant.soil}`,
            `Watering: ${d.schedule.water.text.toLowerCase()}${d.schedule.water.own ? ' (own)' : ''}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </ScrollView>
      <View style={[C.bottomBar, { paddingBottom: insets.bottom + 48 }]}>
        <View style={shared.grow}>
          <PrimaryButton label="Log care" onPress={() => a.openLog(firstDue(d) ?? 'water')} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add note"
          onPress={() => a.openLog('note')}
          style={({ pressed }) => [C.noteButton, pressed && shared.pressed]}
        >
          <SymbolView name="square.and.pencil" size={20} tintColor={colors.tint} />
        </Pressable>
      </View>
    </View>
  );
}

function firstDue(d: Detail): CareType | null {
  return d.care ? (CARE_TYPES.find((type) => isDue(d.care![type])) ?? null) : null;
}

const C = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.l,
    paddingHorizontal: space.xl,
    paddingTop: space.s,
  },
  headerText: { gap: space.xs },
  when: { width: 64, fontSize: 15, fontWeight: '600', color: colors.label },
  dayNumber: {
    width: 28,
    fontSize: 20,
    fontWeight: '700',
    color: colors.label,
    textAlign: 'center',
  },
  nothing: { padding: space.xl, textAlign: 'center' },
  about: { marginHorizontal: space.xxxl, marginTop: space.l },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingTop: space.m,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  noteButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
});

const shared = StyleSheet.create({
  grow: { flex: 1 },
  centered: { textAlign: 'center' },
  pressed: { opacity: 0.6 },
  pressedRow: { backgroundColor: colors.fill },
  scientific: { ...text.subheadline, fontStyle: 'italic', textAlign: 'center' },
  scientificLeft: { ...text.subheadline, fontStyle: 'italic' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    marginTop: space.xs,
    paddingHorizontal: space.s + 2,
    paddingVertical: space.xs,
    borderRadius: 12,
  },
  badgeCentered: { alignSelf: 'center' },
  badgeToxic: { backgroundColor: toxicBackground },
  badgeSafe: { backgroundColor: colors.fill },
  badgeText: { fontSize: 13, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    marginTop: space.l,
  },
});
