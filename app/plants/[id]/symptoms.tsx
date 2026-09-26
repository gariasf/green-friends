import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SYMPTOMS } from '@/src/proto/careGuide';
import { Row } from '@/src/proto/GuideViews';
import { colors, group, space, text } from '@/src/ui/theme';

/** PROTOTYPE (Care Guide): what you can see going wrong, to pick from. Never merged. */
export default function SymptomsScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]/symptoms'>();
  const pests = new Set(['webbing', 'cottony', 'sticky-bumps', 'gnats', 'silver-streaks']);
  const list = (ids: typeof SYMPTOMS) =>
    ids.map((symptom, index) => (
      <Row
        key={symptom.id}
        first={index === 0}
        symbol={pests.has(symptom.id) ? 'pest' : 'leaf'}
        tint={pests.has(symptom.id) ? colors.secondaryLabel : colors.tint}
        title={symptom.name}
        onPress={() =>
          router.push({
            pathname: '/plants/[id]/symptom',
            params: { id, symptom: symptom.id },
          })
        }
      />
    ));
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'What do you see?' }} />
      <Text style={[group.header, styles.head]}>Leaves and stems</Text>
      <View style={group.box}>{list(SYMPTOMS.filter((s) => !pests.has(s.id)))}</View>
      <Text style={[group.header, styles.head]}>Pests</Text>
      <View style={group.box}>{list(SYMPTOMS.filter((s) => pests.has(s.id)))}</View>
      <Text style={[text.footnote, styles.head]}>
        Pick what you see, and the causes most likely for this plant come first.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  head: { marginHorizontal: space.xl, marginTop: space.xl, marginBottom: space.s },
});
