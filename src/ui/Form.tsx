import { useId } from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, pressedStyle, space, text } from '@/src/ui/theme';

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
 * A button that is only its label, in the tint, or in red when it destroys something;
 * `accessibilityLabel` names it for VoiceOver where the label alone is ambiguous.
 */
export function TextButton({
  label,
  destructive = false,
  accessibilityLabel,
  onPress,
  style,
}: {
  label: string;
  destructive?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // A line of body text is about 20 pt tall; this makes it a 44 pt target.
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && pressedStyle.button]}
    >
      <Text style={[styles.textButton, destructive && styles.destructive]}>{label}</Text>
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
  destructive: { color: colors.danger },
});
