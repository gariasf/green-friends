import { StyleSheet, Text, View } from 'react-native';

/** Today: plants that Need Attention. Placeholder shows the "all caught up" empty state. */
export default function TodayScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>All caught up</Text>
      <Text style={styles.subtitle}>Nothing needs attention today.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  subtitle: { fontSize: 16, color: '#666' },
});
