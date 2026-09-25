import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useId } from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { localDay, localNoon, shiftDays } from '@/src/core/dates';
import { ChipGroup } from '@/src/ui/Chip';
import { accessibilitySize, colors, pressedStyle, space, text } from '@/src/ui/theme';

const NUMBER_PADS: TextInputProps['keyboardType'][] = ['number-pad', 'decimal-pad', 'numeric'];

/**
 * A text field with its label above it and, optionally, its unit after the value ("cm"). A number
 * pad has no return key, so it gets a Done bar above it.
 */
export function Field({
  label,
  suffix,
  ...props
}: TextInputProps & { label?: string; suffix?: string }) {
  const doneBar = useId();
  const numberPad = NUMBER_PADS.includes(props.keyboardType);
  return (
    <View style={styles.fieldBlock}>
      {/* The input carries the label for VoiceOver. */}
      {label && (
        <Text accessibilityElementsHidden style={styles.label}>
          {label}
        </Text>
      )}
      <View style={styles.field}>
        <TextInput
          style={[styles.input, props.multiline && styles.multiline]}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.tint}
          accessibilityLabel={label && suffix ? `${label}, ${suffix}` : label}
          inputAccessoryViewID={numberPad ? doneBar : undefined}
          {...props}
        />
        {suffix && (
          <Text accessibilityElementsHidden style={styles.suffix}>
            {suffix}
          </Text>
        )}
      </View>
      {numberPad && (
        <InputAccessoryView nativeID={doneBar}>
          <View style={styles.doneBar}>
            <TextButton label="Done" onPress={Keyboard.dismiss} />
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

/**
 * When care happened, as a local calendar day (ADR-0005), labelled above like a Field: Today and
 * Yesterday in one tap, any earlier day from iOS's compact date picker, which always shows the day
 * chosen and never offers a future one. `optional` adds "Not sure", which picks null.
 */
export function WhenPicker({
  label,
  ...props
}: { label: string } & (
  | { optional?: false; value: string; onChange: (day: string) => void }
  | { optional: true; value: string | null; onChange: (day: string | null) => void }
)) {
  const { fontScale } = useWindowDimensions();
  const today = localDay(new Date());
  const quick = [
    ...(props.optional ? [{ label: 'Not sure', value: null }] : []),
    { label: 'Today', value: today },
    { label: 'Yesterday', value: shiftDays(today, -1) },
  ];
  const pick = (day: string | null) => {
    if (day !== null) props.onChange(day);
    else if (props.optional) props.onChange(null);
  };
  const chips = <ChipGroup options={quick} value={props.value} onChange={pick} />;
  // Sized by its SwiftUI content both ways (the community datetime-picker drop-in only matches it
  // vertically, and collapses in a row). A Host inside a row that wraps loses its place (@expo/ui
  // 57), so it sits beside what may wrap, never within it. Left to SwiftUI's safe areas, its content
  // rides up by the keyboard's inset while a sheet's keyboard is up. With "Not sure" it shows today,
  // dimmed; picking today there changes nothing, so it fires nothing: the Today chip does that.
  const picker = (
    <Host
      matchContents
      ignoreSafeArea="all"
      seedColor={colors.tint}
      style={props.value === null && styles.unset}
    >
      <DatePicker
        selection={localNoon(props.value ?? today)}
        range={{ end: localNoon(today) }}
        onDateChange={(date) => pick(localDay(date))}
        modifiers={[datePickerStyle('compact'), labelsHidden()]}
      />
    </Host>
  );
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      {/* Beside the chips, the pill would squeeze them until words break at accessibility text
          sizes, so there it takes a line of its own, as it always does beside "Not sure".
          ponytail: a font-scale threshold, not a measurement; measure the chips with onLayout if a
          longer date ever squeezes them. */}
      {props.optional || accessibilitySize(fontScale) ? (
        <View style={styles.whenStack}>
          {chips}
          <View style={styles.pickerRow}>
            <Text style={[text.subheadline, styles.grow]}>Or pick a day</Text>
            {picker}
          </View>
        </View>
      ) : (
        <View style={styles.pickerRow}>
          <View style={styles.grow}>{chips}</View>
          {picker}
        </View>
      )}
    </View>
  );
}

/** Closes a sheet: iOS's grey ⓧ, top right. */
export function CloseButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      // 30 pt across; this makes it a 44 pt target.
      hitSlop={7}
      onPress={() => router.back()}
      style={({ pressed }) => pressed && pressedStyle.button}
    >
      <SymbolView name="xmark.circle.fill" size={30} tintColor={colors.tertiaryLabel} />
    </Pressable>
  );
}

/** The one filled button that completes a form. */
export function PrimaryButton({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && pressedStyle.button,
      ]}
    >
      <Text style={[styles.buttonLabel, disabled && styles.buttonLabelDisabled]}>{label}</Text>
    </Pressable>
  );
}

/**
 * A button that is only its label, in the tint, in red when it destroys something, or grey while
 * disabled; `accessibilityLabel` names it for VoiceOver where the label alone is ambiguous.
 */
export function TextButton({
  label,
  destructive = false,
  disabled = false,
  accessibilityLabel,
  onPress,
  style,
}: {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      // A line of body text is about 20 pt tall; this makes it a 44 pt target.
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && pressedStyle.button]}
    >
      <Text
        style={[
          styles.textButton,
          destructive && styles.destructive,
          disabled && styles.textButtonDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Tells the user why a core mutation refused a form, in the core's own words; `then` runs once they have read it. */
export function alertError(title: string, error: unknown, then?: () => void): void {
  Alert.alert(title, error instanceof Error ? error.message : String(error), [
    { text: 'OK', onPress: then },
  ]);
}

/** Blank means not given; anything else goes to the core as a number for it to validate. */
export function optionalNumber(input: string): number | null {
  const trimmed = input.trim();
  return trimmed === '' ? null : Number(trimmed.replace(',', '.'));
}

const styles = StyleSheet.create({
  fieldBlock: { gap: space.xs },
  label: { ...text.footnote, marginLeft: space.xs },
  grow: { flex: 1 },
  whenStack: { gap: space.s },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  unset: { opacity: 0.45 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: space.m,
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  input: { ...text.body, flex: 1, paddingVertical: space.s },
  multiline: { minHeight: 88 },
  suffix: { ...text.body, color: colors.secondaryLabel, marginLeft: space.s },
  doneBar: {
    alignItems: 'flex-end',
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  button: {
    minHeight: 50,
    marginTop: space.m,
    paddingHorizontal: space.xl,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  buttonDisabled: { backgroundColor: colors.fill },
  buttonLabel: { ...text.headline, color: colors.onTint },
  buttonLabelDisabled: { color: colors.tertiaryLabel },
  textButton: { ...text.body, color: colors.tint },
  textButtonDisabled: { color: colors.tertiaryLabel },
  destructive: { color: colors.danger },
});
