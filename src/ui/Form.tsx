import { DatePicker, Host, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import {
  controlSize,
  datePickerStyle,
  labelsHidden,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useId, useState } from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { localDay, localNoon, shiftDays } from '@/src/core/dates';
import { ChipGroup } from '@/src/ui/Chip';
import { Icon } from '@/src/ui/Icon';
import { colors, pressedStyle, radius, space, target, text } from '@/src/ui/theme';

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
 * Yesterday in one tap, and Earlier… for iOS's compact date picker, which always shows the day
 * chosen and never offers a future one. `optional` adds "Not sure", which picks null. The picker
 * waits behind Earlier… (spec #84), shown too while the day is neither chip's: it writes its date
 * in the device region's format ("28 Sep 2026"), which the app's ("Sep 28") can't set.
 */
export function WhenPicker({
  label,
  ...props
}: { label: string } & (
  | { optional?: false; value: string; onChange: (day: string) => void }
  | { optional: true; value: string | null; onChange: (day: string | null) => void }
)) {
  const [earlier, setEarlier] = useState(false);
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
  const picking = earlier || !quick.some((option) => option.value === props.value);
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.whenStack}>
        <ChipGroup
          options={[...quick, { label: 'Earlier…', value: EARLIER }]}
          value={picking ? EARLIER : props.value}
          onChange={(value) => {
            setEarlier(value === EARLIER);
            if (value !== EARLIER) pick(value);
          }}
        />
        {picking && (
          <View style={styles.pickerRow}>
            <Text style={[text.subheadline, styles.grow]}>Pick a day</Text>
            {/* Sized by its SwiftUI content both ways (the community datetime-picker drop-in only
                matches it vertically, and collapses in a row). A Host inside a row that wraps loses
                its place (@expo/ui 57), so it sits beside what may wrap, never within it. Left to
                SwiftUI's safe areas, its content rides up by the keyboard's inset while a sheet's
                keyboard is up. */}
            <Host matchContents ignoreSafeArea="all" seedColor={colors.tint}>
              <DatePicker
                selection={localNoon(props.value ?? today)}
                range={{ end: localNoon(today) }}
                onDateChange={(date) => pick(localDay(date))}
                modifiers={[datePickerStyle('compact'), labelsHidden()]}
              />
            </Host>
          </View>
        )}
      </View>
    </View>
  );
}

/** The Earlier… chip's value: no day of its own, it shows the picker. */
const EARLIER = 'earlier';

/**
 * iOS's segmented control, picking one of `options` by index with a selection haptic. At its
 * extra-large size, 47 pt tall: the regular one is 31 pt, short of a 44 pt target (ticket #30).
 */
export function Segmented({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: number;
  onChange: (index: number) => void;
}) {
  return (
    <Host matchContents={{ vertical: true }} ignoreSafeArea="all">
      <Picker
        label=""
        selection={selected}
        onSelectionChange={(index) => {
          Haptics.selectionAsync();
          onChange(index);
        }}
        modifiers={[pickerStyle('segmented'), controlSize('extraLarge')]}
      >
        {options.map((option, index) => (
          <SwiftText key={index} modifiers={[tag(index)]}>
            {option}
          </SwiftText>
        ))}
      </Picker>
    </Host>
  );
}

/** Closes a sheet: iOS's grey ⓧ, top right. */
export function CloseButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      // 29 pt across as drawn; this makes it a 45 pt target.
      hitSlop={8}
      onPress={() => router.back()}
      style={({ pressed }) => pressed && pressedStyle.button}
    >
      <Icon name="clear" size={30} color={colors.tertiaryLabel} />
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
 * disabled; `accessibilityLabel` names it for VoiceOver where the label alone is ambiguous, and
 * `accessibilityHint` says what it does where that isn't obvious. In a `header`, it is a 44 pt
 * target by its own size, its text growing no larger than the header's title.
 */
export function TextButton({
  label,
  destructive = false,
  disabled = false,
  header = false,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  style,
  color,
}: {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  header?: boolean;
  /** The label's colour where the tint won't read, such as white over the Plant screen's photo. */
  color?: ColorValue;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      // A line of body text is about 20 pt tall; this makes it a 44 pt target.
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [header && target.text, style, pressed && pressedStyle.button]}
    >
      <Text
        // A header's title and UIKit's own header buttons don't grow with Dynamic Type.
        maxFontSizeMultiplier={header ? 1 : undefined}
        style={[
          styles.textButton,
          destructive && styles.destructive,
          disabled && styles.buttonLabelDisabled,
          color !== undefined && { color },
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: space.m,
    borderRadius: radius.inner,
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
    borderRadius: radius.inner,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  buttonDisabled: { backgroundColor: colors.fill },
  buttonLabel: { ...text.headline, color: colors.onTint },
  buttonLabelDisabled: { color: colors.tertiaryLabel },
  textButton: { ...text.body, color: colors.tint },
  destructive: { color: colors.danger },
});
