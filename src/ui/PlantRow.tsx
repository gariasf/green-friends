import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlantPhoto, photoUri } from '@/src/ui/Photo';
import { colors, group, space, text } from '@/src/ui/theme';

/**
 * A plant's scientific name for the line beneath its name, or none where it would repeat the name,
 * as for a Species known by its scientific name (Aloe vera, Hoya pubicalyx).
 */
export function scientificBeneath(name: string, scientificName: string | null): string | null {
  return scientificName === name ? null : scientificName;
}

/**
 * A plant in a grouped list: its photo, Display Name and up to two lines beneath; the whole row
 * opens it. `first` drops the divider above the first row of a group.
 */
export function PlantRow({
  photo,
  name,
  detail,
  status,
  first = false,
  onPress,
}: {
  photo: string | null;
  name: string;
  detail: string | null;
  status?: string | null;
  first?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <PlantPhoto uri={photoUri(photo)} size={48} />
      <View style={[styles.body, !first && group.divider]}>
        <View style={styles.grow}>
          <Text style={text.body} numberOfLines={1}>
            {name}
          </Text>
          {detail && (
            <Text style={styles.scientific} numberOfLines={1}>
              {detail}
            </Text>
          )}
          {status && <Text style={text.footnote}>{status}</Text>}
        </View>
        <SymbolView
          name="chevron.right"
          size={14}
          weight="semibold"
          tintColor={colors.tertiaryLabel}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingLeft: space.l },
  pressed: { backgroundColor: colors.fill },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: 64,
    paddingVertical: space.s,
    paddingRight: space.l,
  },
  grow: { flex: 1, gap: 1 },
  scientific: { ...text.subheadline, fontStyle: 'italic' },
});
