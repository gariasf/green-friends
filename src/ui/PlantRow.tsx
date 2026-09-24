import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlantPhoto, photoUri } from '@/src/ui/Photo';

/** A plant in a list: its photo, Display Name and one line beneath; the whole row opens it. */
export function PlantRow({
  photo,
  name,
  detail,
  onPress,
}: {
  photo: string | null;
  name: string;
  detail: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <PlantPhoto uri={photoUri(photo)} size={44} />
      <View style={styles.grow}>
        <Text style={styles.name}>{name}</Text>
        {detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  pressed: { backgroundColor: '#f2f2f7' },
  grow: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '500' },
  detail: { fontSize: 14, color: '#666' },
  chevron: { fontSize: 20, color: '#aeaeb5' },
});
