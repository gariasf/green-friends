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
  type TextInputProps,
} from 'react-native';

import { colors, space, text } from '@/src/ui/theme';

const NUMERIC = ['number-pad', 'decimal-pad', 'numeric'];

/**
 * A text field with its label above it and an optional unit after it ("cm"). Number pads have no
 * return key, so theirs gets a Done bar above the keyboard.
 */
export function Field({
  label,
  suffix,
  style,
  ...props
}: TextInputProps & { label?: string; suffix?: string }) {
  const accessory = useId();
  const numeric = NUMERIC.includes(props.keyboardType ?? '');
  return (
    <View style={styles.fieldBlock}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.field, props.multiline && styles.multiline]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.tertiaryLabel}
          accessibilityLabel={label}
          inputAccessoryViewID={numeric ? accessory : undefined}
          {...props}
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
      {numeric && (
        <InputAccessoryView nativeID={accessory}>
          <View style={styles.accessory}>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={Keyboard.dismiss}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
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
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** A plain text button in the brand colour, for secondary actions and links. */
export function TextButton({
  label,
  onPress,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.textButtonPressed}
    >
      <Text style={[styles.textButton, destructive && styles.textButtonDestructive]}>{label}</Text>
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
export function optionalNumber(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : Number(trimmed.replace(',', '.'));
}

const styles = StyleSheet.create({
  fieldBlock: { gap: space.xs + 2 },
  label: { ...text.footnote, marginLeft: space.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: space.m,
    borderRadius: 10,
    backgroundColor: colors.fill,
  },
  multiline: { alignItems: 'flex-start', minHeight: 88, paddingVertical: space.s },
  input: { flex: 1, fontSize: 17, color: colors.label, paddingVertical: space.s },
  suffix: { ...text.body, color: colors.secondaryLabel, marginLeft: space.s },
  accessory: {
    alignItems: 'flex-end',
    paddingHorizontal: space.l,
    paddingVertical: space.s + 2,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  done: { fontSize: 17, fontWeight: '600', color: colors.tint },
  button: {
    minHeight: 50,
    paddingHorizontal: space.xl,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { fontSize: 17, fontWeight: '600', color: colors.onTint },
  textButton: { fontSize: 17, color: colors.tint },
  textButtonDestructive: { color: colors.destructive },
  textButtonPressed: { opacity: 0.5 },
});
