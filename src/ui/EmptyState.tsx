import { SymbolView, type SFSymbol } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/src/ui/Form';
import { colors, space, text } from '@/src/ui/theme';

/**
 * What a screen or a list shows while it has nothing to show (spec #22): a symbol, a title, one
 * line of explanation and, where one applies, the action that fills it.
 */
export function EmptyState({
  symbol,
  title,
  line,
  action,
}: {
  symbol: SFSymbol;
  title: string;
  line: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <SymbolView accessibilityElementsHidden name={symbol} size={44} tintColor={colors.tint} />
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.line}>{line}</Text>
      {action && <TextButton label={action.label} onPress={action.onPress} style={styles.action} />}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.s, padding: space.xxxl },
  title: { ...text.title3, textAlign: 'center' },
  line: { ...text.subheadline, textAlign: 'center' },
  action: { marginTop: space.s },
});
