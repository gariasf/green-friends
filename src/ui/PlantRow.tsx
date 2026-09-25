import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlantPhoto, photoUri } from '@/src/ui/Photo';
import { colors, group, pressedStyle, space, text } from '@/src/ui/theme';

/**
 * A plant's scientific name for the line beneath its name, or none where it would repeat the name,
 * as for a Species known by its scientific name (Aloe vera, Hoya pubicalyx).
 */
export function scientificBeneath(name: string, scientificName: string | null): string | null {
  return scientificName === name ? null : scientificName;
}

/**
 * A plant in a group of rows: its photo, Display Name and one line beneath; the whole row opens
 * it. A group's `first` row has no divider above it.
 */
export function PlantRow({
  photo,
  name,
  detail,
  first,
  onPress,
}: {
  photo: string | null;
  name: string;
  detail: string | null;
  first: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedStyle.row]}
    >
      <PlantPhoto uri={photoUri(photo)} size={44} />
      {/* The divider starts after the photo and stops short of the far edge, as in iOS 26. */}
      <View style={[styles.body, !first && group.divider]}>
        <View style={styles.grow}>
          <Text style={text.body}>{name}</Text>
          {detail && <Text style={text.subheadline}>{detail}</Text>}
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
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: 64,
    marginRight: space.l,
    paddingVertical: space.s,
  },
  grow: { flex: 1 },
});
