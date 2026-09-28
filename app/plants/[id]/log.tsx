import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { dueCare, evaluateCare } from '@/src/core/care';
import { CARE_EVENT_TYPES, logCareEvent, type CareEventType } from '@/src/core/careLog';
import { localDay, shiftDays } from '@/src/core/dates';
import { getDisplayName } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, useCareEventDetails } from '@/src/ui/CareEvent';
import {
  alertError,
  CloseButton,
  PrimaryButton,
  Segmented,
  SheetBody,
  useConfirmDiscard,
  WhenPicker,
} from '@/src/ui/Form';
import { proto, useProto } from '@/src/ui/FormsPrototype';
import { taskHaptic, useSheetEntering } from '@/src/ui/motion';
import { colors, font, space, text, TITLE2_MAX_SCALE } from '@/src/ui/theme';

/**
 * The log sheet (spec #22): logs any care type or a Note on any day up to today, a repot with its
 * new pot and soil. Opens preset to the care type in its `type` param, else the first one Due. An
 * Archived plant is out of care, so for one it only adds a Note. A `note` param fills the Note.
 */
export default function LogCareSheet() {
  const {
    id,
    type: preset,
    note,
    when,
  } = useLocalSearchParams<'/plants/[id]/log', { type?: string; note?: string; when?: string }>();
  const [displayName] = useState(() => getDisplayName(db, id));
  // ponytail: evaluates the whole garden to find one plant; fine at dozens of plants, a core read
  // of one plant by id at hundreds.
  const [inCare] = useState(() => evaluateCare(db).find((candidate) => candidate.id === id));
  const [type, setType] = useState<CareEventType>(() =>
    inCare
      ? (CARE_EVENT_TYPES.find((option) => option === preset) ??
        dueCare(inCare)[0]?.type ??
        'water')
      : 'note',
  );
  // PROTOTYPE words B: Log earlier… opens on Yesterday.
  const [day, setDay] = useState(() =>
    when === 'earlier' && proto().words === 'B'
      ? shiftDays(localDay(new Date()), -1)
      : localDay(new Date()),
  );
  const { words } = useProto();
  // A Symptom's Log it as a Note fills the Note.
  const details = useCareEventDetails(type, { note });
  const enter = useSheetEntering();
  // Only what was typed asks before it goes; a day is one tap to pick again.
  const leave = useConfirmDiscard(
    details.changed,
    type === 'note' ? 'Discard this note?' : 'Discard this repot?',
  );

  const log = () => {
    if (details.problem) return alertError('Could not log it', new Error(details.problem));
    try {
      logCareEvent(db, { plantId: id, type, occurredOn: day, ...details.values });
      taskHaptic();
      leave();
    } catch (error) {
      alertError('Could not log it', error);
    }
  };

  return (
    <SheetBody>
      <View style={styles.header}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`Log care, ${displayName}`}
          style={styles.grow}
        >
          {/* PROTOTYPE words: B the name raised, C the name as the title. */}
          {words !== 'C' && (
            <Text style={words === 'B' ? styles.nameRaised : text.footnote}>{displayName}</Text>
          )}
          <Text maxFontSizeMultiplier={TITLE2_MAX_SCALE} style={text.title2}>
            {words === 'C' ? displayName : 'Log care'}
          </Text>
          {words === 'C' && <Text style={text.footnote}>Log care</Text>}
        </View>
        <CloseButton />
      </View>
      {inCare && (
        <Animated.View entering={enter(1)}>
          <Segmented
            options={CARE_EVENT_TYPES.map((option) => CARE_COPY[option].label)}
            selected={CARE_EVENT_TYPES.indexOf(type)}
            onChange={(index) => setType(CARE_EVENT_TYPES[index])}
          />
        </Animated.View>
      )}
      <Animated.View entering={enter(2)} style={styles.part}>
        <WhenPicker label="When did it happen?" value={day} onChange={setDay} />
        {details.fields}
      </Animated.View>
      <Animated.View entering={enter(3)}>
        <PrimaryButton
          label={type === 'note' ? 'Add note' : `Mark as ${CARE_COPY[type].done.toLowerCase()}`}
          disabled={!details.complete}
          onPress={log}
        />
      </Animated.View>
    </SheetBody>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.m },
  grow: { flex: 1 },
  part: { gap: space.l },
  nameRaised: { ...text.subheadline, ...font.semibold, color: colors.label },
});
