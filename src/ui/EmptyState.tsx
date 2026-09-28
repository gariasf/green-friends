import { StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/src/ui/Form';
import { Icon, type IconName } from '@/src/ui/Icon';
import { colors, space, text, TITLE2_MAX_SCALE } from '@/src/ui/theme';

/**
 * What a screen or a list shows while it has nothing to show (spec #22): a symbol, a title, one
 * line of explanation where the title needs one and, where one applies, the action that fills it.
 */
export function EmptyState({
  symbol,
  title,
  line,
  action,
}: {
  symbol: IconName;
  title: string;
  line?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <Icon name={symbol} size={44} color={colors.tint} />
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={TITLE2_MAX_SCALE}
        style={styles.title}
      >
        {title}
      </Text>
      {line ? (
        <Text lineBreakStrategyIOS="standard" style={styles.line}>
          {line}
        </Text>
      ) : null}
      {action && <TextButton label={action.label} onPress={action.onPress} style={styles.action} />}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.s, padding: space.xxxl },
  title: { ...text.title2, textAlign: 'center' },
  line: { ...text.subheadline, textAlign: 'center' },
  action: { marginTop: space.s },
});
