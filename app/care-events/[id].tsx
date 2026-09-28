import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { deleteCareEvent, editCareEvent, getCareEvent } from '@/src/core/careLog';
import { getDisplayName } from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, CareSymbol, useCareEventDetails } from '@/src/ui/CareEvent';
import {
  alertError,
  CloseButton,
  PrimaryButton,
  SheetBody,
  TextButton,
  useConfirmDiscard,
  WhenPicker,
} from '@/src/ui/Form';
import { useProto } from '@/src/ui/FormsPrototype';
import { useSheetEntering } from '@/src/ui/motion';
import { accessibilitySize, colors, font, space, text, TITLE2_MAX_SCALE } from '@/src/ui/theme';

/** What deleting a Care Event changes, by its type: a Note changes no due date. */
const DELETE_LINE = {
  water: 'Due dates then count from the rest of the log.',
  fertilize: 'Due dates then count from the rest of the log.',
  repot: "Due dates then count from the rest of the log. The plant's pot stays as it is.",
  note: undefined,
};

/**
 * One Care Event from the Care Log, to edit (its day, a Note's text, a repot's pot size and soil)
 * or delete. Due-ness re-derives from whatever the Care Log then holds; the plant's Current Pot
 * stays as it is (CONTEXT.md), which a repot's fields say.
 */
export default function CareEventSheet() {
  const { id } = useLocalSearchParams<'/care-events/[id]'>();
  const [event] = useState(() => getCareEvent(db, id));
  // PROTOTYPE words: B the plant's name above the title, C the name as the title.
  const [name] = useState(() => getDisplayName(db, event.plantId));
  const { words } = useProto();
  const [occurredOn, setOccurredOn] = useState(event.occurredOn);
  const details = useCareEventDetails(event.type, event);
  const enter = useSheetEntering();
  const leave = useConfirmDiscard(
    details.changed || occurredOn !== event.occurredOn,
    'Discard your changes?',
  );
  // Beside the icon and ⓧ, the title breaks mid-word at the largest text sizes, so there it stacks.
  const stacked = accessibilitySize(useWindowDimensions().fontScale);

  const save = () => {
    if (details.problem) return alertError('Could not save it', new Error(details.problem));
    try {
      editCareEvent(db, event.id, { occurredOn, ...details.values });
      leave();
    } catch (error) {
      alertError('Could not save it', error);
    }
  };

  const remove = () =>
    Alert.alert('Delete from the Care Log?', DELETE_LINE[event.type], [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCareEvent(db, event.id);
          leave();
        },
      },
    ]);

  const title = (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={TITLE2_MAX_SCALE}
      style={[text.title2, !stacked && styles.grow]}
    >
      {CARE_COPY[event.type].done}
    </Text>
  );

  if (words === 'C') {
    return (
      <SheetBody>
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={TITLE2_MAX_SCALE}
            style={[text.title2, styles.grow]}
          >
            {name}
          </Text>
          <CloseButton />
        </View>
        <View style={styles.typeLine}>
          <CareSymbol type={event.type} size={16} />
          <Text style={styles.nameRaised}>{CARE_COPY[event.type].done}</Text>
        </View>
        {body()}
      </SheetBody>
    );
  }

  return (
    <SheetBody>
      {words === 'B' && <Text style={styles.nameRaised}>{name}</Text>}
      <View style={styles.header}>
        <CareSymbol type={event.type} size={22} />
        {stacked ? <View style={styles.grow} /> : title}
        <CloseButton />
      </View>
      {stacked && title}
      {body()}
    </SheetBody>
  );

  function body() {
    return (
      <>
        <Animated.View entering={enter(1)} style={styles.part}>
          <WhenPicker label="When did it happen?" value={occurredOn} onChange={setOccurredOn} />
          {details.fields}
          {event.type === 'repot' && (
            <Text lineBreakStrategyIOS="standard" style={text.footnote}>
              {"The plant's pot stays as it is; change it in Edit plant."}
            </Text>
          )}
        </Animated.View>
        <Animated.View entering={enter(2)} style={styles.part}>
          <PrimaryButton label="Save" disabled={!details.complete} onPress={save} />
          <TextButton label="Delete" destructive onPress={remove} style={styles.delete} />
        </Animated.View>
      </>
    );
  }
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  grow: { flex: 1 },
  delete: { alignSelf: 'center' },
  part: { gap: space.l },
  nameRaised: { ...text.subheadline, ...font.semibold, color: colors.label },
  typeLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
