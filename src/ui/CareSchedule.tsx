import { SegmentedControl } from '@expo/ui/community/segmented-control';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CARE_TYPES,
  hasOverride,
  SEASONAL,
  type CareSchedule,
  type CareType,
} from '@/src/core/plants';
import { CARE_COPY, CareSymbol } from '@/src/ui/CareEvent';
import { Field, optionalNumber } from '@/src/ui/Form';
import { space, text } from '@/src/ui/theme';

/**
 * One care type's schedule as the form holds it: an Override while `own`, else the Species
 * default. `growing` is the Growing interval, or repotting's only one, in months (ADR-0003).
 */
type CareTypeForm = { own: boolean; growing: string; dormant: string };

/**
 * A plant's care schedule as Edit plant, and New plant without a Species, set it (spec #22): per
 * care type, a segmented control between the Species default ("None" without a known Species) and
 * an Override of the plant's own (ADR-0003), every so many days and, in the Dormant season, every
 * so many or Paused; repotting every so many months. It starts from the plant's Overrides where
 * set, else from the defaults they'd shadow. Gives the fields to show, the Override columns they
 * set (null for a care type left to its default), and why they can't be saved yet, if they can't.
 */
export function useCareSchedule(plant: CareSchedule, defaults: CareSchedule | null) {
  const [form, setForm] = useState(() => startingSchedule(plant, defaults));
  const own = (type: CareType, interval: string) =>
    form[type].own ? optionalNumber(interval) : null;
  // A blank Growing interval would clear the Override (ADR-0003), not keep an own schedule.
  const blank = CARE_TYPES.find((type) => form[type].own && !form[type].growing.trim());

  return {
    fields: CARE_TYPES.map((type) => (
      <CareTypeSchedule
        key={type}
        type={type}
        value={form[type]}
        defaults={defaults}
        onChange={(value) => setForm((current) => ({ ...current, [type]: value }))}
      />
    )),
    overrides: {
      wateringGrowingDays: own('water', form.water.growing),
      wateringDormantDays: own('water', form.water.dormant),
      fertilizingGrowingDays: own('fertilize', form.fertilize.growing),
      fertilizingDormantDays: own('fertilize', form.fertilize.dormant),
      repottingMonths: own('repot', form.repot.growing),
    } satisfies CareSchedule,
    problem: blank
      ? `${CARE_COPY[blank].label}: enter how often, or pick ${defaults ? 'Species default' : 'None'}.`
      : null,
  };
}

function CareTypeSchedule({
  type,
  value,
  defaults,
  onChange,
}: {
  type: CareType;
  value: CareTypeForm;
  defaults: CareSchedule | null;
  onChange: (value: CareTypeForm) => void;
}) {
  const { label } = CARE_COPY[type];
  return (
    <View style={styles.careType}>
      <View style={styles.careTypeHead}>
        <CareSymbol type={type} size={18} />
        <Text style={text.headline}>{label}</Text>
      </View>
      <SegmentedControl
        values={[defaults ? 'Species default' : 'None', 'Own schedule']}
        selectedIndex={value.own ? 1 : 0}
        onChange={({ nativeEvent }) => {
          Haptics.selectionAsync();
          onChange({ ...value, own: nativeEvent.selectedSegmentIndex === 1 });
        }}
      />
      {!value.own && <Text style={text.subheadline}>{describeDefault(type, defaults)}</Text>}
      {value.own && type === 'repot' && (
        <Field
          label="Every"
          suffix="months"
          value={value.growing}
          onChangeText={(growing) => onChange({ ...value, growing })}
          keyboardType="number-pad"
          accessibilityLabel={`${label}, months`}
        />
      )}
      {value.own && type !== 'repot' && (
        <>
          <Field
            label="Growing season, every"
            suffix="days"
            value={value.growing}
            onChangeText={(growing) => onChange({ ...value, growing })}
            keyboardType="number-pad"
            accessibilityLabel={`${label}, Growing season, days`}
          />
          <Field
            label="Dormant season, every"
            suffix="days"
            placeholder="Paused"
            value={value.dormant}
            onChangeText={(dormant) => onChange({ ...value, dormant })}
            keyboardType="number-pad"
            accessibilityLabel={`${label}, Dormant season, days`}
          />
          <Text style={text.footnote}>Blank pauses it in the Dormant season.</Text>
        </>
      )}
    </View>
  );
}

/**
 * Where the form starts: each care type's Override where one is set, else the Species default, so
 * an Override begins from the values it shadows.
 */
function startingSchedule(
  plant: CareSchedule,
  defaults: CareSchedule | null,
): Record<CareType, CareTypeForm> {
  const asText = (value: number | null | undefined) => value?.toString() ?? '';
  const seasonal = (type: 'water' | 'fertilize'): CareTypeForm => {
    const { growing, dormant } = SEASONAL[type];
    const own = hasOverride(plant, type);
    const source = own ? plant : defaults;
    return { own, growing: asText(source?.[growing]), dormant: asText(source?.[dormant]) };
  };
  const ownRepot = hasOverride(plant, 'repot');
  return {
    water: seasonal('water'),
    fertilize: seasonal('fertilize'),
    repot: {
      own: ownRepot,
      growing: asText((ownRepot ? plant : defaults)?.repottingMonths),
      dormant: '',
    },
  };
}

/** A care type's Species default in words; a plant with no Species has none. */
function describeDefault(type: CareType, defaults: CareSchedule | null): string {
  if (!defaults) return 'Never Due.';
  if (type === 'repot') {
    return defaults.repottingMonths === null
      ? 'Never.'
      : `Every ${defaults.repottingMonths} months.`;
  }
  const growing = defaults[SEASONAL[type].growing];
  const dormant = defaults[SEASONAL[type].dormant];
  if (growing === null) return 'Never.';
  return dormant === null
    ? `Every ${growing} days, paused in the Dormant season.`
    : `Every ${growing} days, every ${dormant} days in the Dormant season.`;
}

const styles = StyleSheet.create({
  careType: { gap: space.s },
  careTypeHead: { flexDirection: 'row', alignItems: 'center', gap: space.s },
});
