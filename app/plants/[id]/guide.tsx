import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { readCareGuide } from '@/src/core/careGuide';
import { localDay } from '@/src/core/dates';
import { db } from '@/src/db/client';
import { GuideBody } from '@/src/ui/CareGuide';
import { guides } from '@/src/ui/guides';

/** A plant's full Care Guide (spec #48), opened from its Plant screen's Care group. */
export default function GuideScreen() {
  const { id } = useLocalSearchParams<'/plants/[id]/guide'>();
  const [today] = useState(() => localDay(new Date()));
  const [guide] = useState(() => readCareGuide(db, id, today, guides));
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Care Guide' }} />
      {guide && <GuideBody id={id} guide={guide} today={today} />}
    </ScrollView>
  );
}
