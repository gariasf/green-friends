import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { plantSeasonOn } from '@/src/core/care';
import { localDay } from '@/src/core/dates';
import {
  CARE_TYPES,
  hasOverride,
  SEASONAL,
  type CareSchedule,
  type CareType,
} from '@/src/core/plants';
import { db } from '@/src/db/client';
import { CARE_COPY, CareSymbol } from '@/src/ui/CareEvent';
import { Field, optionalNumber, Segmented, wholeNumber } from '@/src/ui/Form';
import { protoForms, useProto } from '@/src/ui/FormsPrototype';
import { Icon } from '@/src/ui/Icon';
import { colors, font, group, pressedStyle, space, text } from '@/src/ui/theme';
import { everyLine, isAllYear, NO_SCHEDULE_LINE, scheduleLine } from '@/src/ui/words';

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
 * columns they set (null for a care type left to its default), whether they differ from the
 * plant's, and why they can't be saved yet, if they can't, in the form's words (#90).
 */
export function useCareSchedule(plant: CareSchedule, defaults: CareSchedule | null) {
  const [form, setForm] = useState(() => startingSchedule(plant));
  // A garden Growing all year has no Dormant season for a default to mention (#82, #90).
  const [allYear] = useState(() => isAllYear(plantSeasonOn(db, null, localDay(new Date()))));
  const { forms, words } = useProto();
  const override = (type: CareType, interval: string) =>
    form[type].own ? optionalNumber(interval) : null;
  // PROTOTYPE words B: an all-year garden hides the Dormant field, so a new Override's Dormant
  // interval copies its Growing one rather than pausing if a Dormant season is made later.
  const dormantOf = (type: 'water' | 'fertilize') =>
    words === 'B' && allYear && !hasOverride(plant, type) && !form[type].dormant.trim()
      ? override(type, form[type].growing)
      : override(type, form[type].dormant);
  const overrides = {
    wateringGrowingDays: override('water', form.water.growing),
    wateringDormantDays: dormantOf('water'),
    fertilizingGrowingDays: override('fertilize', form.fertilize.growing),
    fertilizingDormantDays: dormantOf('fertilize'),
    repottingMonths: override('repot', form.repot.growing),
  } satisfies CareSchedule;

  const rows = CARE_TYPES.map((type, index) => (
    <CareTypeSchedule
      key={type}
      index={index}
      type={type}
      value={form[type]}
      defaults={defaults}
      allYear={allYear}
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
  ));

  return {
    // PROTOTYPE forms C: one outlined card, a row per care type.
    fields: forms === 'C' ? <View style={protoForms.outlineCard}>{rows}</View> : rows,
    overrides,
    changed: (Object.keys(overrides) as (keyof CareSchedule)[]).some(
      (column) => !Object.is(overrides[column], plant[column]),
    ),
    problem: scheduleProblem(form, defaults ? 'Species schedule' : 'None'),
  };
}

/**
 * Why an own schedule can't be saved yet, or null: a Growing interval (repotting's only one) is a
 * whole number, 1 or more, since a blank one would clear the Override (ADR-0003); a Dormant one is
 * that or blank, for Paused. The core checks the same, in its own words.
 */
function scheduleProblem(form: Record<CareType, CareTypeForm>, orPick: string): string | null {
  for (const type of CARE_TYPES) {
    const { own, growing, dormant } = form[type];
    if (!own) continue;
    const { label } = CARE_COPY[type];
    if (!growing.trim()) return `${label}: enter how often, or pick ${orPick}.`;
    if (!wholeNumber(growing)) {
      return `${label}: enter whole ${type === 'repot' ? 'months' : 'days'}, 1 or more.`;
    }
    if (dormant.trim() && !wholeNumber(dormant)) {
      return `${label}: enter whole days for the Dormant season, or leave it blank.`;
    }
  }
  return null;
}

function CareTypeSchedule({
  index,
  type,
  value,
  defaults,
  allYear,
  onChange,
}: {
  index: number;
  type: CareType;
  value: CareTypeForm;
  defaults: CareSchedule | null;
  allYear: boolean;
  onChange: (value: CareTypeForm) => void;
}) {
  const { label } = CARE_COPY[type];
  const { forms, words } = useProto();
  // PROTOTYPE words: B hides the Dormant field in an all-year garden; C folds it into one line.
  const [dormantOpen, setDormantOpen] = useState(false);
  const hideDormant = words === 'B' && allYear;
  const foldDormant = words === 'C' && !dormantOpen;
  return (
    <View
      style={[
        styles.careType,
        forms === 'B' && index > 0 && styles.careTypeApart,
        forms === 'C' && styles.careTypeRow,
        forms === 'C' && index > 0 && group.divider,
      ]}
    >
      <View style={styles.careTypeHead}>
        <CareSymbol type={type} size={18} />
        {/* A care row's label, a step under the form's heading (#90). */}
        <Text accessibilityRole="header" style={styles.careTypeLabel}>
          {label}
        </Text>
      </View>
      <Segmented
        options={[defaults ? 'Species schedule' : 'None', 'Own schedule']}
        selected={value.own ? 1 : 0}
        onChange={(index) => onChange({ ...value, own: index === 1 })}
      />
      {!value.own && (
        <Text lineBreakStrategyIOS="standard" style={text.subheadline}>
          {describeDefault(type, defaults, allYear)}
        </Text>
      )}
      {value.own && type === 'repot' && (
        <Field
          label={forms === 'C' ? 'How often' : 'Every'}
          prefix="every"
          suffix="months"
          placeholder="Required"
          value={value.growing}
          onChangeText={(growing) => onChange({ ...value, growing })}
          keyboardType="number-pad"
          accessibilityLabel={`${label}, months`}
        />
      )}
      {value.own && type !== 'repot' && (
        <>
          <Field
            label={
              hideDormant
                ? forms === 'C'
                  ? 'How often'
                  : 'Every'
                : forms === 'C'
                  ? 'Growing season'
                  : 'Growing season, every'
            }
            prefix="every"
            suffix="days"
            placeholder="Required"
            value={value.growing}
            onChangeText={(growing) => onChange({ ...value, growing })}
            keyboardType="number-pad"
            accessibilityLabel={`${label}, Growing season, days`}
          />
          {!hideDormant && foldDormant && (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Sets how often in a Dormant season"
              onPress={() => setDormantOpen(true)}
              style={({ pressed }) => [styles.fold, pressed && pressedStyle.button]}
            >
              <Text style={text.subheadline}>
                In a Dormant season:{' '}
                {value.dormant.trim() ? `every ${value.dormant.trim()} days` : 'Paused'}
              </Text>
              <Icon name="next" size={14} color={colors.tertiaryLabel} />
            </Pressable>
          )}
          {!hideDormant && !foldDormant && (
            <>
              <Field
                label={forms === 'C' ? 'Dormant season' : 'Dormant season, every'}
                prefix="every"
                suffix="days"
                placeholder="Paused"
                value={value.dormant}
                onChangeText={(dormant) => onChange({ ...value, dormant })}
                keyboardType="number-pad"
                accessibilityLabel={`${label}, Dormant season, days`}
              />
              <Text lineBreakStrategyIOS="standard" style={text.footnote}>
                Blank pauses it in the Dormant season.
              </Text>
            </>
          )}
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

/**
 * A care type's Species default in words, as the Care Guide says it ("Every 7 days, every 14 days
 * in the Dormant season."); a plant with no Species has none.
 */
function describeDefault(type: CareType, defaults: CareSchedule | null, allYear: boolean): string {
  if (type === 'repot') {
    const months = defaults?.repottingMonths ?? null;
    return `${months === null ? NO_SCHEDULE_LINE : everyLine(months, 'month')}.`;
  }
  const growing = defaults?.[SEASONAL[type].growing] ?? null;
  if (growing === null) return `${NO_SCHEDULE_LINE}.`;
  const line = scheduleLine(
    { growing, dormant: defaults?.[SEASONAL[type].dormant] ?? null },
    allYear,
  );
  return `${line[0].toUpperCase()}${line.slice(1)}.`;
}

const styles = StyleSheet.create({
  careType: { gap: space.s },
  careTypeHead: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  careTypeLabel: { ...text.subheadline, ...font.semibold, color: colors.label },
  careTypeApart: { marginTop: space.m },
  careTypeRow: { paddingVertical: space.m },
  fold: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
