import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';

import type { SeasonOn } from '@/src/core/care';
import {
  CARE_GUIDES_LIGHT,
  type CareGuide,
  type CareProfile,
  type Cause,
} from '@/src/core/careGuide';
import { CARE_COPY } from '@/src/ui/CareEvent';
import { Segmented } from '@/src/ui/Form';
import { colors, group, pressedStyle, space, text } from '@/src/ui/theme';
import {
  feedLine,
  LIGHT_WORDS,
  lightLabel,
  NO_CARE_GUIDE,
  PET_WARNING,
  seasonLine,
  SOMETHING_WRONG,
  yourSchedule,
} from '@/src/ui/words';

/**
 * The phone's Care Guide (spec #48, the prototype's variant A): the Care group on the Plant screen,
 * the full Care Guide, and the rows and cards the Symptom screens show. The text is the bundled
 * `assets/care-guides.json` (ADR-0008, `src/ui/guides.ts`).
 */

type Season = SeasonOn['season'];

const WATER = CARE_COPY.water;
const FEED = CARE_COPY.fertilize;

function openSymptoms(id: string) {
  router.push({ pathname: '/plants/[id]/symptoms', params: { id } });
}

/** A row of a group: a symbol, a title and what follows it; a chevron when it opens something. */
export function Row({
  symbol,
  tint,
  title,
  body,
  children,
  label,
  onPress,
  first,
}: {
  symbol: SFSymbol;
  tint: ColorValue;
  title: string;
  body?: string;
  children?: ReactNode;
  /** What VoiceOver reads, where the title and body alone don't say it. */
  label?: string;
  onPress?: () => void;
  first?: boolean;
}) {
  const content = (
    <>
      <SymbolView accessibilityElementsHidden name={symbol} size={20} tintColor={tint} />
      <View style={styles.rowText}>
        <Text style={text.headline}>{title}</Text>
        {body ? <Text style={text.subheadline}>{body}</Text> : null}
        {children}
      </View>
      {onPress && (
        <SymbolView
          accessibilityElementsHidden
          name="chevron.right"
          size={13}
          weight="semibold"
          tintColor={colors.tertiaryLabel}
        />
      )}
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={[styles.row, !first && group.divider]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && group.divider, pressed && pressedStyle.row]}
    >
      {content}
    </Pressable>
  );
}

/** Something wrong? ›, to the Symptoms. */
function SomethingWrong({ id, first }: { id: string; first?: boolean }) {
  return (
    <Row
      first={first}
      symbol="stethoscope"
      tint={colors.secondaryLabel}
      title="Something wrong?"
      body={SOMETHING_WRONG}
      onPress={() => openSymptoms(id)}
    />
  );
}

/**
 * The shared light scale, dimmest first, with this profile's step filled in, and its step and
 * direct sun in words beneath: "Bright indirect · Morning sun". VoiceOver reads `lightLabel` from
 * the row or card holding it.
 */
function LightScale({ light }: { light: CareProfile['light'] }) {
  return (
    <View style={styles.scale}>
      <View style={styles.steps}>
        {CARE_GUIDES_LIGHT.level.map((level) => (
          <View key={level} style={[styles.step, level === light.level && styles.stepMarked]} />
        ))}
      </View>
      <Text style={text.subheadline}>
        {LIGHT_WORDS.level[light.level]} · {LIGHT_WORDS.directSun[light.directSun]}
      </Text>
    </View>
  );
}

/**
 * The Plant screen's Care group, between the tiles and the Care Log, headed with today's Season:
 * how to water, feed and place the plant now, then the full Care Guide and the Symptoms. Without a
 * profile, a nudge to set a Species, and the Symptoms.
 */
export function CareGroup({
  id,
  guide,
  season,
  today,
}: {
  id: string;
  guide: CareGuide | null;
  season: SeasonOn;
  today: string;
}) {
  const profile = guide?.profile;
  const now = season.season;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={group.header}>
          Care
        </Text>
        <Text style={[text.footnote, styles.grow, styles.end]}>{seasonLine(season, today)}</Text>
      </View>
      <View style={group.box}>
        {profile ? (
          <>
            <Row
              first
              symbol={WATER.symbol}
              tint={WATER.hue}
              title="Water"
              body={profile.watering[now]}
            />
            <Row symbol={FEED.symbol} tint={FEED.hue} title="Feed" body={feedLine(profile, now)} />
            <Row
              symbol="sun.max.fill"
              tint={colors.sun}
              title="Light"
              label={lightLabel(profile.light)}
            >
              <LightScale light={profile.light} />
            </Row>
            <Row
              symbol="book.fill"
              tint={colors.tint}
              title="Full Care Guide"
              onPress={() => router.push({ pathname: '/plants/[id]/guide', params: { id } })}
            />
          </>
        ) : (
          <NoCareGuide />
        )}
        <SomethingWrong id={id} />
      </View>
    </View>
  );
}

function NoCareGuide() {
  return (
    <Row
      first
      symbol="leaf.fill"
      tint={colors.tint}
      title={NO_CARE_GUIDE.title}
      body={NO_CARE_GUIDE.line}
    />
  );
}

/**
 * The full Care Guide: the profile and today's Season, then a Growing | Dormant switch opening on
 * today's, and a card each for watering, fertiliser, light and warmth, and soil, the first two
 * with the plant's real schedule; then its care notes, Something wrong? and its Fun fact.
 */
export function GuideBody({ id, guide, today }: { id: string; guide: CareGuide; today: string }) {
  const [season, setSeason] = useState<Season>(guide.season.season);
  const { profile, schedule } = guide;
  return (
    <View style={styles.body}>
      <View style={styles.inset}>
        <Text style={text.footnote}>
          {profile.name} · {seasonLine(guide.season, today)}
        </Text>
        <Segmented
          options={['Growing', 'Dormant']}
          selected={season === 'growing' ? 0 : 1}
          onChange={(index) => setSeason(index === 0 ? 'growing' : 'dormant')}
        />
      </View>

      <Card symbol={WATER.symbol} tint={WATER.hue} title="Watering">
        <Text style={text.body}>{profile.watering[season]}</Text>
        <Text style={text.body}>{profile.watering.how}</Text>
        <YourSchedule line={yourSchedule(schedule.water)} />
      </Card>

      <Card symbol={FEED.symbol} tint={FEED.hue} title="Fertiliser">
        <Text style={text.headline}>{profile.fertilizer.type}</Text>
        <Text style={text.body}>{profile.fertilizer[season]}</Text>
        <YourSchedule line={yourSchedule(schedule.fertilize)} />
      </Card>

      <Card symbol="sun.max.fill" tint={colors.sun} title="Light and warmth">
        <View accessible accessibilityLabel={lightLabel(profile.light)}>
          <LightScale light={profile.light} />
        </View>
        <Text style={text.body}>{profile.light.text}</Text>
      </Card>

      <Card symbol="square.stack.3d.up.fill" tint={colors.secondaryLabel} title="Soil">
        <Text style={text.body}>{profile.soil}</Text>
      </Card>

      {guide.careNotes && (
        <Card symbol="leaf.fill" tint={colors.tint} title="This plant">
          <Text style={text.body}>{guide.careNotes}</Text>
        </Card>
      )}

      <View style={group.box}>
        <SomethingWrong id={id} first />
      </View>

      <Card symbol="lightbulb.fill" tint={colors.tint} title="Fun fact">
        <Text style={text.body}>{guide.funFact.text}</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(guide.funFact.source)}
          // The link's line is 20 pt; this makes it a 44 pt target inside the card's padding.
          hitSlop={12}
          style={({ pressed }) => [styles.linkButton, pressed && pressedStyle.button]}
        >
          <Text style={styles.link}>More on Wikipedia</Text>
        </Pressable>
      </Card>
    </View>
  );
}

/** A card on the background: a symbol and a heading, then what it holds. */
function Card({
  symbol,
  tint,
  title,
  children,
}: {
  symbol: SFSymbol;
  tint: ColorValue;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.line}>
        <SymbolView accessibilityElementsHidden name={symbol} size={18} tintColor={tint} />
        <Text accessibilityRole="header" style={[text.title3, styles.grow]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/**
 * One of a Symptom's causes: what the Care Log says beside it (`fact`, when it has one) in a quiet
 * box, how to tell, what to do, the pet warning where it has one, and Log it as a Note.
 */
export function CauseCard({
  cause,
  fact,
  onLog,
}: {
  cause: Cause;
  fact: string | null;
  onLog: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={text.title3}>
        {cause.name}
      </Text>
      {fact && (
        <View accessible style={styles.fact}>
          <SymbolView
            accessibilityElementsHidden
            name="clock.arrow.circlepath"
            size={14}
            tintColor={colors.secondaryLabel}
          />
          <Text style={[text.footnote, styles.grow]}>{fact}</Text>
        </View>
      )}
      <Text accessibilityRole="header" style={text.headline}>
        How to tell
      </Text>
      <Text style={text.body}>{cause.tell}</Text>
      <Text accessibilityRole="header" style={text.headline}>
        What to do
      </Text>
      <Text style={text.body}>{cause.fix}</Text>
      {cause.petWarning && (
        <View accessible style={styles.warning}>
          <SymbolView
            accessibilityElementsHidden
            name="pawprint.fill"
            size={13}
            tintColor={colors.caution}
          />
          <Text style={[text.footnote, styles.caution, styles.grow]}>{PET_WARNING}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens a Note with this cause filled in"
        // The button's line is 20 pt; this makes it a 44 pt target inside the card's padding.
        hitSlop={12}
        onPress={onLog}
        style={({ pressed }) => [styles.linkButton, styles.line, pressed && pressedStyle.button]}
      >
        <SymbolView
          accessibilityElementsHidden
          name="note.text"
          size={14}
          tintColor={colors.tint}
        />
        <Text style={styles.link}>Log it as a Note</Text>
      </Pressable>
    </View>
  );
}

function YourSchedule({ line }: { line: string }) {
  return (
    <View style={styles.line}>
      <SymbolView
        accessibilityElementsHidden
        name="calendar"
        size={14}
        tintColor={colors.secondaryLabel}
      />
      <Text style={[text.footnote, styles.grow]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  end: { textAlign: 'right' },
  section: { marginTop: space.xxl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.m,
    marginHorizontal: space.xl,
    marginBottom: space.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    minHeight: 52,
  },
  rowText: { flex: 1, gap: 2 },
  scale: { gap: space.xs, marginTop: space.xs },
  steps: { flexDirection: 'row', gap: space.xs },
  step: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.fill },
  stepMarked: { backgroundColor: colors.sun },
  card: {
    gap: space.s,
    marginHorizontal: space.l,
    padding: space.l,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  body: { gap: space.l, paddingTop: space.l, paddingBottom: space.xxl },
  inset: { gap: space.s, marginHorizontal: space.xl },
  linkButton: { alignSelf: 'flex-start' },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    padding: space.s,
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  caution: { color: colors.caution },
  link: { ...text.subheadline, fontWeight: '600', color: colors.tint },
});
