import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/src/ui/Icon';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { localDay } from '@/src/core/dates';
import { CAUSES, readGuide, SYMPTOMS } from '@/src/proto/careGuide';
import { colors, pressedStyle, space, text, font } from '@/src/ui/theme';

/**
 * PROTOTYPE (Care Guide): one Symptom, its causes in the order likeliest for this plant's profile,
 * each with how to tell, the fix and what the Care Log says beside it. Never merged.
 */
export default function SymptomScreen() {
  const { id, symptom: symptomId } = useLocalSearchParams<
    '/plants/[id]/symptom',
    { symptom: string }
  >();
  const [guide] = useState(() => readGuide(id, localDay(new Date())));
  const symptom = SYMPTOMS.find((candidate) => candidate.id === symptomId)!;
  const causes = guide.causesOf(symptom);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: symptom.name }} />
      <Text style={[text.footnote, styles.intro]}>
        {guide.profile
          ? `Most likely for a ${guide.profile.name.toLowerCase()} first.`
          : 'Most likely first.'}
      </Text>
      {causes.map((causeId, index) => {
        const cause = CAUSES[causeId];
        return (
          <View key={causeId} style={styles.card}>
            <Text accessibilityRole="header" style={text.headline}>
              {index === 0 ? 'Likeliest: ' : ''}
              {cause.name}
            </Text>
            {cause.fact && (
              <View style={styles.fact}>
                <Icon name="history" size={14} color={colors.secondaryLabel} />
                <Text style={[text.footnote, styles.grow]}>{guide.fact(cause.fact)}</Text>
              </View>
            )}
            <Text style={text.headline}>How to tell</Text>
            <Text style={text.body}>{cause.tell}</Text>
            <Text style={text.headline}>What to do</Text>
            <Text style={text.body}>{cause.fix}</Text>
            {cause.petWarning && (
              <View style={styles.warning}>
                <Icon name="pet" size={13} color={colors.caution} weight="fill" />
                <Text style={[text.footnote, styles.caution, styles.grow]}>
                  Neem oil and rubbing alcohol can harm pets: keep them away until the leaves are
                  dry.
                </Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() =>
                router.push({
                  pathname: '/plants/[id]/log',
                  params: {
                    id,
                    type: 'note',
                    note: `${symptom.name}: maybe ${cause.name.toLowerCase()}.`,
                  },
                })
              }
              style={({ pressed }) => [styles.logButton, pressed && pressedStyle.button]}
            >
              <Icon name="note" size={14} color={colors.tint} />
              <Text style={styles.link}>Log it as a Note</Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.l, paddingBottom: space.xxl },
  intro: { marginHorizontal: space.xl, marginTop: space.l },
  grow: { flex: 1 },
  card: {
    gap: space.s,
    marginHorizontal: space.l,
    padding: space.l,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    padding: space.s,
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  caution: { color: colors.caution },
  logButton: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  link: { ...text.subheadline, ...font.semibold, color: colors.tint },
});
