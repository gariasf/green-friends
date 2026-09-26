import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { localDay } from '@/src/core/dates';
import { readGuide } from '@/src/proto/careGuide';
import { GuideBody } from '@/src/proto/GuideViews';

/** PROTOTYPE (Care Guide): the full guide, for variants A and B. Never merged. */
export default function GuideScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]/guide'>();
  const [guide] = useState(() => readGuide(id, localDay(new Date())));
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Care Guide' }} />
      <GuideBody id={id} guide={guide} />
    </ScrollView>
  );
}
