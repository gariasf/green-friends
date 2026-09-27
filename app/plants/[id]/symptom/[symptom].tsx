import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { causeFact, readCareGuide, symptomCauses } from '@/src/core/careGuide';
import { localDay } from '@/src/core/dates';
import { db } from '@/src/db/client';
import { guides } from '@/src/ui/CareGuide';
import { colors, pressedStyle, space, text } from '@/src/ui/theme';
import { causeFactLine, causesIntro, PET_WARNING, symptomNote } from '@/src/ui/words';

/**
 * One Symptom (spec #48): its causes, those typical of the plant's Care Profile first, each with
 * what the Care Log says beside it, how to tell, what to do, and Log it as a Note. The order says
 * which is likelier; no card claims to be the cause.
 */
export default function SymptomScreen() {
  const { id, symptom: symptomId } = useLocalSearchParams<'/plants/[id]/symptom/[symptom]'>();
  const [today] = useState(() => localDay(new Date()));
  const [profile] = useState(() => readCareGuide(db, id, today, guides)?.profile ?? null);
  const symptom = guides.symptoms.find((candidate) => candidate.id === symptomId);
  if (!symptom) return null;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: symptom.name }} />
      <Text style={[text.footnote, styles.intro]}>{causesIntro(profile)}</Text>
      {symptomCauses(symptom, profile).map((causeId) => {
        const cause = guides.causes[causeId];
        return (
          <View key={causeId} style={styles.card}>
            <Text accessibilityRole="header" style={text.title3}>
              {cause.name}
            </Text>
            {cause.fact && (
              <View accessible style={styles.fact}>
                <SymbolView
                  accessibilityElementsHidden
                  name="clock.arrow.circlepath"
                  size={14}
                  tintColor={colors.secondaryLabel}
                />
                <Text style={[text.footnote, styles.grow]}>
                  {causeFactLine(causeFact(db, id, cause.fact, today), today)}
                </Text>
              </View>
            )}
            <Text accessibilityRole="header" style={text.headline}>
              How to tell
            </Text>
            <Text style={text.body}>{cause.tell}</Text>
            <Text accessibilityRole="header" style={text.headline}>
              What to do
            </Text>
            <Text style={text.body}>{cause.fix}</Text>
            {cause.petWarning && (
              <View accessible style={styles.warning}>
                <SymbolView
                  accessibilityElementsHidden
                  name="pawprint.fill"
                  size={13}
                  tintColor={colors.caution}
                />
                <Text style={[text.footnote, styles.caution, styles.grow]}>{PET_WARNING}</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Opens a Note with this cause filled in"
              // The button's line is 20 pt; this makes it a 44 pt target inside the card's padding.
              hitSlop={12}
              onPress={() =>
                router.push({
                  pathname: '/plants/[id]/log',
                  params: {
                    id,
                    type: 'note',
                    note: symptomNote(symptom, cause.name),
                  },
                })
              }
              style={({ pressed }) => [styles.logButton, pressed && pressedStyle.button]}
            >
              <SymbolView
                accessibilityElementsHidden
                name="note.text"
                size={14}
                tintColor={colors.tint}
              />
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
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    marginTop: space.xs,
  },
  link: { ...text.subheadline, fontWeight: '600', color: colors.tint },
});
