import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { searchSpecies, type Species } from '@/src/core/species';
import { db } from '@/src/db/client';
import { EmptyState } from '@/src/ui/EmptyState';
import { Field, TextButton } from '@/src/ui/Form';
import { scientificBeneath } from '@/src/ui/PlantRow';
import { accessibilitySize, colors, group, pressedStyle, space, text } from '@/src/ui/theme';

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
            {scientific && <Text style={text.subheadline}>{scientific}</Text>}
          </Pressable>
        );
      })}
      {query.trim() !== '' && matches.length === 0 ? (
        <EmptyState
          symbol="magnifyingglass"
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

/** The Species picked (or its absence), with the action that changes it. */
export function PickedSpecies({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string | null;
  action: string;
  onAction: () => void;
}) {
  // Beside the action, the title breaks mid-word at accessibility text sizes, so there it stacks.
  const stacked = accessibilitySize(useWindowDimensions().fontScale);
  return (
    <View style={[styles.picked, stacked && styles.pickedStacked]}>
      <View style={!stacked && styles.grow}>
        <Text style={text.body}>{title}</Text>
        {subtitle && <Text style={text.subheadline}>{subtitle}</Text>}
      </View>
      <TextButton label={action} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  // One line tall for a Species known by its scientific name; still a 44 pt target.
  match: { minHeight: 44, justifyContent: 'center', paddingVertical: space.s },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: 10,
    // Not tintSoft: the tinted action reads only 2.46:1 on Ecru.
    backgroundColor: colors.surface,
  },
  pickedStacked: { flexDirection: 'column', alignItems: 'flex-start' },
});
