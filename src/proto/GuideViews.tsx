import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';

import { CARE_COPY } from '@/src/ui/CareEvent';
import { Segmented } from '@/src/ui/Form';
import { colors, group, pressedStyle, space, text } from '@/src/ui/theme';

import type { Guide, Season } from './careGuide';

/**
 * PROTOTYPE (Care Guide): the pieces the variants are built from. Never merged.
 */

/** The first sentence, for a summary line. */
export function firstSentence(line: string): string {
  const end = line.indexOf('. ');
  return end === -1 ? line : line.slice(0, end + 1);
}

const WATER = CARE_COPY.water;
const FEED = CARE_COPY.fertilize;

export function openGuide(id: string) {
  router.push({ pathname: '/plants/[id]/guide', params: { id } });
}

export function openSymptoms(id: string) {
  router.push({ pathname: '/plants/[id]/symptoms', params: { id } });
}

/** A row of a group: a symbol, a title and its lines; a chevron when it opens something. */
export function Row({
  symbol,
  tint,
  title,
  body,
  onPress,
  first,
}: {
  symbol: SFSymbol;
  tint: ColorValue;
  title: string;
  body?: string;
  onPress?: () => void;
  first?: boolean;
}) {
  const content = (
    <>
      <SymbolView accessibilityElementsHidden name={symbol} size={20} tintColor={tint} />
      <View style={styles.rowText}>
        <Text style={text.headline}>{title}</Text>
        {body ? <Text style={text.subheadline}>{body}</Text> : null}
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
  if (!onPress) return <View style={[styles.row, !first && group.divider]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && group.divider, pressed && pressedStyle.row]}
    >
      {content}
    </Pressable>
  );
}

/** Variant A: the summary as a group of rows, below the tiles. */
export function SummaryRows({ id, guide }: { id: string; guide: Guide }) {
  const { profile, season } = guide;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={group.header}>
          Care
        </Text>
        <Text style={text.footnote}>{guide.seasonLine}</Text>
      </View>
      <View style={group.box}>
        {profile ? (
          <>
            <Row
              first
              symbol={WATER.symbol}
              tint={WATER.hue}
              title="Water"
              body={profile.watering[season]}
            />
            <Row
              symbol={FEED.symbol}
              tint={FEED.hue}
              title="Feed"
              body={season === 'dormant' ? profile.fertilizer.dormant : profile.fertilizer.type}
            />
            <Row
              symbol="sun.max.fill"
              tint={colors.caution}
              title="Light"
              body={firstSentence(profile.light)}
            />
            <Row
              symbol="book.fill"
              tint={colors.tint}
              title="Full Care Guide"
              onPress={() => openGuide(id)}
            />
          </>
        ) : (
          <NoProfile first />
        )}
        <Row
          symbol="stethoscope"
          tint={colors.secondaryLabel}
          title="Something wrong?"
          body="Brown tips, yellow leaves, pests"
          onPress={() => openSymptoms(id)}
        />
      </View>
    </View>
  );
}

/** Variant B: one card with the three lines that matter today, and two ways on. */
export function SummaryCard({ id, guide }: { id: string; guide: Guide }) {
  const { profile, season } = guide;
  return (
    <View style={[styles.card, styles.section]}>
      <View style={styles.cardHead}>
        <Text accessibilityRole="header" style={text.title3}>
          How to care for it
        </Text>
        <Text style={styles.pill}>{season === 'dormant' ? 'Dormant' : 'Growing'}</Text>
      </View>
      {profile ? (
        <View style={styles.lines}>
          <Line symbol={WATER.symbol} tint={WATER.hue} line={profile.watering[season]} />
          <Line
            symbol={FEED.symbol}
            tint={FEED.hue}
            line={
              season === 'dormant'
                ? firstSentence(profile.fertilizer.dormant)
                : firstSentence(profile.fertilizer.growing)
            }
          />
          <Line symbol="sun.max.fill" tint={colors.caution} line={firstSentence(profile.light)} />
        </View>
      ) : (
        <Text style={text.subheadline}>Set a Species to see how to water, feed and place it.</Text>
      )}
      <View style={styles.buttons}>
        {profile && <Chip label="Full guide" onPress={() => openGuide(id)} />}
        <Chip label="Something wrong?" onPress={() => openSymptoms(id)} />
      </View>
    </View>
  );
}

function Line({ symbol, tint, line }: { symbol: SFSymbol; tint: ColorValue; line: string }) {
  return (
    <View style={styles.line}>
      <SymbolView accessibilityElementsHidden name={symbol} size={17} tintColor={tint} />
      <Text style={[text.body, styles.grow]}>{line}</Text>
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && pressedStyle.button]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function NoProfile({ first }: { first?: boolean }) {
  return (
    <Row
      first={first}
      symbol="leaf.fill"
      tint={colors.tint}
      title="No Care Guide yet"
      body="Set a Species to see how to water, feed and place it."
    />
  );
}

/**
 * The whole Care Guide: the full guide screen shows it, variant C shows it in place of the Care
 * Log. Opens on today's Season; the other is a tap away.
 */
export function GuideBody({ id, guide }: { id: string; guide: Guide }) {
  const [season, setSeason] = useState<Season>(guide.season);
  const { profile } = guide;
  if (!profile) {
    return (
      <View style={styles.section}>
        <View style={group.box}>
          <NoProfile first />
          <Row
            symbol="stethoscope"
            tint={colors.secondaryLabel}
            title="Something wrong?"
            onPress={() => openSymptoms(id)}
          />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.body}>
      <View style={styles.inset}>
        <Text style={text.footnote}>
          {profile.name} · {guide.seasonLine}
        </Text>
        <Segmented
          options={['Growing', 'Dormant']}
          selected={season === 'growing' ? 0 : 1}
          onChange={(index) => setSeason(index === 0 ? 'growing' : 'dormant')}
        />
      </View>

      <Section symbol={WATER.symbol} tint={WATER.hue} title="Watering">
        <Text style={text.body}>{profile.watering[season]}</Text>
        <Text style={text.body}>{profile.watering.how}</Text>
        <Schedule line={guide.schedule.water} />
      </Section>

      <Section symbol={FEED.symbol} tint={FEED.hue} title="Fertiliser">
        <Text style={text.headline}>{profile.fertilizer.type}</Text>
        <Text style={text.body}>{profile.fertilizer[season]}</Text>
        <Schedule line={guide.schedule.fertilize} />
      </Section>

      <Section symbol="sun.max.fill" tint={colors.caution} title="Light and warmth">
        <Text style={text.body}>{profile.light}</Text>
      </Section>

      <Section symbol="square.stack.3d.up.fill" tint={colors.secondaryLabel} title="Soil">
        <Text style={text.body}>{profile.soil}</Text>
      </Section>

      {guide.careNotes && (
        <Section symbol="leaf.fill" tint={colors.tint} title="This plant">
          <Text style={text.body}>{guide.careNotes}</Text>
        </Section>
      )}

      <View style={group.box}>
        <Row
          first
          symbol="stethoscope"
          tint={colors.secondaryLabel}
          title="Something wrong?"
          body="Brown tips, yellow leaves, pests"
          onPress={() => openSymptoms(id)}
        />
      </View>

      {guide.funFact && (
        <View style={[styles.card, styles.fact]}>
          <View style={styles.line}>
            <SymbolView
              accessibilityElementsHidden
              name="lightbulb.fill"
              size={17}
              tintColor={colors.tint}
            />
            <Text style={text.headline}>Fun fact</Text>
          </View>
          <Text style={text.body}>{guide.funFact.text}</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(guide.funFact!.source)}
            hitSlop={8}
          >
            <Text style={styles.link}>More on Wikipedia</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Section({
  symbol,
  tint,
  title,
  children,
}: {
  symbol: SFSymbol;
  tint: ColorValue;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.line}>
        <SymbolView accessibilityElementsHidden name={symbol} size={18} tintColor={tint} />
        <Text accessibilityRole="header" style={text.title3}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Schedule({ line }: { line: string }) {
  return (
    <View style={styles.line}>
      <SymbolView
        accessibilityElementsHidden
        name="calendar"
        size={14}
        tintColor={colors.secondaryLabel}
      />
      <Text style={text.footnote}>Your schedule: {line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  section: { marginTop: space.xxl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
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
  card: {
    gap: space.s,
    marginHorizontal: space.l,
    padding: space.l,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    ...text.footnote,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: space.s,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.tintSoft,
    color: colors.tint,
  },
  lines: { gap: space.m, marginTop: space.xs },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s },
  chip: {
    paddingHorizontal: space.m,
    paddingVertical: space.s,
    borderRadius: 16,
    backgroundColor: colors.fill,
  },
  chipText: { ...text.subheadline, fontWeight: '600', color: colors.tint },
  body: { gap: space.l, paddingTop: space.l, paddingBottom: space.xxl },
  inset: { gap: space.s, marginHorizontal: space.xl },
  fact: { backgroundColor: colors.tintSoft },
  link: { ...text.subheadline, fontWeight: '600', color: colors.tint },
});
