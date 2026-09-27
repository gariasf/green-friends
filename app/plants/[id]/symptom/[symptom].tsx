import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { causeFact, readCareGuide, symptomCauses } from '@/src/core/careGuide';
import { localDay } from '@/src/core/dates';
import { db } from '@/src/db/client';
import { CauseCard } from '@/src/ui/CareGuide';
import { guides } from '@/src/ui/guides';
import { space, text } from '@/src/ui/theme';
import { causeFactLine, causesIntro, symptomNote } from '@/src/ui/words';

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
          <CauseCard
            key={causeId}
            cause={cause}
            fact={cause.fact ? causeFactLine(causeFact(db, id, cause.fact, today), today) : null}
            onLog={() =>
              router.push({
                pathname: '/plants/[id]/log',
                params: { id, type: 'note', note: symptomNote(symptom, cause.name) },
              })
            }
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.l, paddingBottom: space.xxl },
  intro: { marginHorizontal: space.xl, marginTop: space.l },
});
