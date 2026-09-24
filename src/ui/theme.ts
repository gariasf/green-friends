import { Color, DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { DynamicColorIOS, StyleSheet, type ColorSchemeName } from 'react-native';

/**
 * PROTOTYPE (UI pass): the app's colours are iOS semantic colours, so every screen follows light
 * and dark mode and Increase Contrast without a line of theme code. Brand green is the one custom
 * colour, light and dark.
 */
export const colors = {
  background: Color.ios.systemGroupedBackground,
  surface: Color.ios.secondarySystemGroupedBackground,
  sheet: Color.ios.systemBackground,
  label: Color.ios.label,
  secondaryLabel: Color.ios.secondaryLabel,
  tertiaryLabel: Color.ios.tertiaryLabel,
  separator: Color.ios.separator,
  fill: Color.ios.tertiarySystemFill,
  tint: DynamicColorIOS({ light: '#2e7d32', dark: '#6fcf73' }),
  onTint: DynamicColorIOS({ light: '#ffffff', dark: '#0b2410' }),
  tintSoft: DynamicColorIOS({ light: '#e8f5e9', dark: '#1d3320' }),
  overdue: Color.ios.systemRed,
  dueToday: Color.ios.systemOrange,
  destructive: Color.ios.systemRed,
};

/** The brand green as plain hex, for the few APIs that take a string, not a platform colour. */
export const TINT_HEX = { light: '#2e7d32', dark: '#6fcf73' };

/** Navigation chrome (headers, tab bar tint) in the same colours, per colour scheme. */
export const navigationTheme = (scheme: ColorSchemeName): Theme => {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: scheme === 'dark' ? TINT_HEX.dark : TINT_HEX.light,
      background: scheme === 'dark' ? '#000000' : '#f2f2f7',
    },
  };
};

/** Spacing steps; nothing uses a value off this list. */
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** iOS text styles at their default Dynamic Type size. */
export const text = StyleSheet.create({
  title1: { fontSize: 28, fontWeight: '700', color: colors.label },
  title2: { fontSize: 22, fontWeight: '700', color: colors.label },
  title3: { fontSize: 20, fontWeight: '600', color: colors.label },
  headline: { fontSize: 17, fontWeight: '600', color: colors.label },
  body: { fontSize: 17, color: colors.label },
  callout: { fontSize: 16, color: colors.label },
  subheadline: { fontSize: 15, color: colors.secondaryLabel },
  footnote: { fontSize: 13, color: colors.secondaryLabel },
  caption: { fontSize: 12, color: colors.secondaryLabel },
  /** A section title above a grouped list, as iOS Settings draws it. */
  sectionHeader: {
    fontSize: 13,
    color: colors.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

/** A white (or dark) rounded group on the grouped background, as in iOS Settings. */
export const group = StyleSheet.create({
  box: {
    marginHorizontal: space.l,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 48,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  header: { marginTop: space.xxl, marginBottom: space.s, marginHorizontal: space.xxxl },
});
