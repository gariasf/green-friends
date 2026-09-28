import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { searchSpecies, type Species } from '@/src/core/species';
import { db } from '@/src/db/client';
import { EmptyState } from '@/src/ui/EmptyState';
import { Field, TextButton } from '@/src/ui/Form';
import { useProto } from '@/src/ui/FormsPrototype';
import { scientificBeneath } from '@/src/ui/words';
import {
  accessibilitySize,
  colors,
  font,
  group,
  pressedStyle,
  radius,
  space,
  text,
} from '@/src/ui/theme';

/**
 * A Species search, as New plant and Edit plant pick one: a search field, the matches best first
 * (searchSpecies), and beneath them the way out, `fallback`, which the empty result offers too.
 */
export function SpeciesSearch({
  onPick,
  fallback,
}: {
  onPick: (species: Species) => void;
  fallback: { label: string; line: string; onPress: () => void };
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchSpecies(db, query), [query]);
  const { species: variant } = useProto();
  if (variant !== 'A') {
    return (
      <SpeciesSearchCard
        query={query}
        setQuery={setQuery}
        matches={matches}
        onPick={onPick}
        fallback={fallback}
        asCard={variant === 'C'}
      />
    );
  }
  return (
    <>
      <Field
        // The heading above labels it; a search field shows what to type.
        placeholder="Search by name, e.g. monstera"
        accessibilityLabel="Search species"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      {matches.map((s, index) => {
        const scientific = scientificBeneath(s.colloquialName, s.scientificName);
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.match,
              index > 0 && group.divider,
              pressed && pressedStyle.row,
            ]}
            onPress={() => onPick(s)}
          >
            <Text style={text.body}>{s.colloquialName}</Text>
            {scientific && <Text style={styles.scientific}>{scientific}</Text>}
          </Pressable>
        );
      })}
      {query.trim() !== '' && matches.length === 0 ? (
        <EmptyState
          symbol="search"
          title="Not in the catalog"
          line={fallback.line}
          action={{ label: fallback.label, onPress: fallback.onPress }}
        />
      ) : (
        <TextButton label={fallback.label} onPress={fallback.onPress} />
      )}
    </>
  );
}

/** PROTOTYPE species B and C: at most 20 matches. */
const SHOWN = 20;

/**
 * PROTOTYPE species B and C: the way back right under the field, the best 20 matches in a card
 * and how many more, and no match inline (B) or as the card a pick turns into (C).
 */
function SpeciesSearchCard({
  query,
  setQuery,
  matches,
  onPick,
  fallback,
  asCard,
}: {
  query: string;
  setQuery: (query: string) => void;
  matches: Species[];
  onPick: (species: Species) => void;
  fallback: { label: string; line: string; onPress: () => void };
  asCard: boolean;
}) {
  const none = query.trim() !== '' && matches.length === 0;
  return (
    <>
      <Field
        placeholder="Search by name, e.g. monstera"
        accessibilityLabel="Search species"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      {none && asCard && (
        <PickedSpecies
          title="Not in the catalog"
          subtitle={fallback.line}
          action={fallback.label}
          stacked
          onAction={fallback.onPress}
        />
      )}
      {none && !asCard && (
        <View style={styles.none}>
          <Text accessibilityRole="header" style={text.headline}>
            Not in the catalog
          </Text>
          <Text lineBreakStrategyIOS="standard" style={text.subheadline}>
            {fallback.line}
          </Text>
        </View>
      )}
      {!(none && asCard) && fallback.label !== '' && (
        <TextButton label={fallback.label} onPress={fallback.onPress} style={styles.back} />
      )}
      {matches.length > 0 && (
        <View style={styles.list}>
          {matches.slice(0, SHOWN).map((s, index) => {
            const scientific = scientificBeneath(s.colloquialName, s.scientificName);
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.listRow,
                  index > 0 && group.divider,
                  pressed && pressedStyle.row,
                ]}
                onPress={() => onPick(s)}
              >
                <Text style={text.body}>{s.colloquialName}</Text>
                {scientific && <Text style={styles.scientific}>{scientific}</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
      {matches.length > SHOWN && (
        <Text style={text.footnote}>
          {matches.length - SHOWN} more. Keep typing to narrow them down.
        </Text>
      )}
    </>
  );
}

/**
 * The Species picked (or its absence), with the action that changes it: under a Species' name its
 * scientific name, in italics as everywhere else, or else a line about the plant's schedule;
 * `actionLabel` names the action for VoiceOver ("Change species").
 */
export function PickedSpecies({
  title,
  scientific,
  subtitle,
  action,
  actionLabel,
  stacked: stackedAlways = false,
  onAction,
}: {
  title: string;
  scientific?: string | null;
  subtitle?: string;
  action: string;
  actionLabel?: string;
  /** PROTOTYPE species C: a long action goes under the words. */
  stacked?: boolean;
  onAction: () => void;
}) {
  // Beside the action, the title breaks mid-word at accessibility text sizes, so there it stacks.
  const { fontScale } = useWindowDimensions();
  const stacked = stackedAlways || accessibilitySize(fontScale);
  return (
    <View style={[styles.picked, stacked && styles.pickedStacked]}>
      <View style={!stacked && styles.grow}>
        <Text style={text.body}>{title}</Text>
        {scientific && <Text style={styles.scientific}>{scientific}</Text>}
        {subtitle && (
          <Text lineBreakStrategyIOS="standard" style={text.subheadline}>
            {subtitle}
          </Text>
        )}
      </View>
      {action !== '' && (
        <TextButton label={action} accessibilityLabel={actionLabel} onPress={onAction} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  scientific: { ...text.subheadline, ...font.italic },
  // One line tall for a Species known by its scientific name; still a 44 pt target.
  match: { minHeight: 44, justifyContent: 'center', paddingVertical: space.s },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: radius.surface,
    borderCurve: 'continuous',
    // Not tintSoft: the tinted action reads only 2.46:1 on Ecru.
    backgroundColor: colors.surface,
  },
  pickedStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  none: { gap: space.xs },
  back: { alignSelf: 'flex-start' },
  list: {
    paddingHorizontal: space.m,
    borderRadius: radius.surface,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  listRow: { minHeight: 44, justifyContent: 'center', paddingVertical: space.s },
});
