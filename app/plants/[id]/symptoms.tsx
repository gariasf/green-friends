import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Symptom } from '@/src/core/careGuide';
import { Row } from '@/src/ui/CareGuide';
import { guides } from '@/src/ui/guides';
import { colors, group, space } from '@/src/ui/theme';
import { SYMPTOM_GROUPS, SYMPTOMS_TITLE } from '@/src/ui/words';

/** Each group's icon, beside every Symptom in it. */
const GROUP_SYMBOL = {
  plant: { symbol: 'leaf', tint: colors.tint },
  pest: { symbol: 'pest', tint: colors.secondaryLabel },
} as const satisfies Record<Symptom['kind'], object>;

/** What can be seen going wrong, to pick from (spec #48): leaves and stems, then pests. */
export default function SymptomsScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]/symptoms'>();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: SYMPTOMS_TITLE }} />
      {SYMPTOM_GROUPS.map(({ kind, title }) => (
        <View key={kind}>
          <Text accessibilityRole="header" style={[group.section, styles.head]}>
            {title}
          </Text>
          <View style={group.box}>
            {guides.symptoms
              .filter((symptom) => symptom.kind === kind)
              .map((symptom, index) => (
                <Row
                  key={symptom.id}
                  first={index === 0}
                  {...GROUP_SYMBOL[kind]}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  head: { marginHorizontal: space.xl, marginTop: space.xl, marginBottom: space.s },
});
