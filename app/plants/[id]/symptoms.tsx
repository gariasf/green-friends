import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { guides, Row } from '@/src/ui/CareGuide';
import { colors, group, space, text } from '@/src/ui/theme';
import { SYMPTOM_GROUPS } from '@/src/ui/words';

/** What can be seen going wrong, to pick from (spec #48): leaves and stems, then pests. */
export default function SymptomsScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]/symptoms'>();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'What do you see?' }} />
      {SYMPTOM_GROUPS.map(({ kind, title }) => (
        <View key={kind}>
          <Text accessibilityRole="header" style={[group.header, styles.head]}>
            {title}
          </Text>
          <View style={group.box}>
            {guides.symptoms
              .filter((symptom) => symptom.kind === kind)
              .map((symptom, index) => (
                <Row
                  key={symptom.id}
                  first={index === 0}
                  symbol={kind === 'pest' ? 'ant.fill' : 'leaf.fill'}
                  tint={kind === 'pest' ? colors.secondaryLabel : colors.tint}
                  title={symptom.name}
                  onPress={() =>
                    router.push({
                      pathname: '/plants/[id]/symptom/[symptom]',
                      params: { id, symptom: symptom.id },
                    })
                  }
                />
              ))}
          </View>
        </View>
      ))}
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
