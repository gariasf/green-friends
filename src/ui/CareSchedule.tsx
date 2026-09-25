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
import { Field, optionalNumber, Segmented } from '@/src/ui/Form';
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
 * so many or Paused; repotting every so many months. Each time an Override is switched on it
 * starts over, from the plant's own values where it has them, else from the defaults it shadows
 * then, as Edit plant's Species can change meanwhile. Gives the fields to show, the Override
 * columns they set (null for a care type left to its default), and why they can't be saved yet,
 * if they can't.
 */
export function useCareSchedule(plant: CareSchedule, defaults: CareSchedule | null) {
  const [form, setForm] = useState(() => startingSchedule(plant));
  const override = (type: CareType, interval: string) =>
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
        onChange={(value) =>
          setForm((current) => ({
            ...current,
            [type]:
              value.own === current[type].own
                ? value
                : {
                    own: value.own,
                    ...intervals(type, hasOverride(plant, type) ? plant : defaults),
                  },
          }))
        }
      />
    )),
    overrides: {
      wateringGrowingDays: override('water', form.water.growing),
      wateringDormantDays: override('water', form.water.dormant),
      fertilizingGrowingDays: override('fertilize', form.fertilize.growing),
      fertilizingDormantDays: override('fertilize', form.fertilize.dormant),
      repottingMonths: override('repot', form.repot.growing),
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
        <Text accessibilityRole="header" style={text.headline}>
          {label}
        </Text>
      </View>
      <Segmented
        options={[defaults ? 'Species default' : 'None', 'Own schedule']}
        selected={value.own ? 1 : 0}
        onChange={(index) => onChange({ ...value, own: index === 1 })}
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

/** Where the form starts: each care type's Override where one is set, else blank until switched on. */
function startingSchedule(plant: CareSchedule): Record<CareType, CareTypeForm> {
  const start = (type: CareType): CareTypeForm => {
    const own = hasOverride(plant, type);
    return { own, ...intervals(type, own ? plant : null) };
  };
  return { water: start('water'), fertilize: start('fertilize'), repot: start('repot') };
}

/** A care type's intervals in `source`, as the form holds them. */
function intervals(type: CareType, source: CareSchedule | null) {
  const asText = (value: number | null | undefined) => value?.toString() ?? '';
  if (type === 'repot') return { growing: asText(source?.repottingMonths), dormant: '' };
  const { growing, dormant } = SEASONAL[type];
  return { growing: asText(source?.[growing]), dormant: asText(source?.[dormant]) };
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
