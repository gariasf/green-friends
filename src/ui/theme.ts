import { Color, DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { DynamicColorIOS, StyleSheet, type ColorSchemeName } from 'react-native';

/** Brand green, per appearance. */
const GREEN = { light: '#2e7d32', dark: '#6fcf73' };

/**
 * The app's colours, the only ones it uses: iOS semantic colours, which follow light and dark
 * mode and Increase Contrast by themselves, and brand green. React Native draws text black unless
 * told otherwise, so every Text takes its colour from here, through `text`.
 */
export const colors = {
  /** Behind a screen's content. */
  background: Color.ios.systemGroupedBackground,
  /** A card or a group of rows on the background. */
  surface: Color.ios.secondarySystemGroupedBackground,
  /** Behind a sheet's content: opaque, and lifted in dark mode. */
  sheet: Color.ios.systemBackground,
  /** Something floating above the screen, such as the undo toast. */
  floating: Color.ios.tertiarySystemBackground,
  label: Color.ios.label,
  secondaryLabel: Color.ios.secondaryLabel,
  tertiaryLabel: Color.ios.tertiaryLabel,
  placeholder: Color.ios.placeholderText,
  separator: Color.ios.separator,
  /** Behind a chip, a field, or a pressed row. */
  fill: Color.ios.tertiarySystemFill,
  tint: DynamicColorIOS(GREEN),
  /** Text on a tint fill. */
  onTint: DynamicColorIOS({ light: '#ffffff', dark: '#0b2410' }),
  /** A pale tint, behind a photo placeholder or a picked Species. */
  tintSoft: DynamicColorIOS({ light: '#e8f5e9', dark: '#1d3320' }),
  /** Overdue care, toxicity, and destructive actions. */
  danger: Color.ios.systemRed,
  /** Care Due today. */
  dueToday: Color.ios.systemOrange,
  // Each kind of Care Event's hue, beside its symbol (CARE_COPY).
  water: Color.ios.systemBlue,
  fertilize: Color.ios.systemYellow,
  repot: Color.ios.systemBrown,
  note: Color.ios.systemGray,
};

/**
 * Headers and the rest of the navigation chrome, for the device's appearance. Plain hex: parts of
 * the navigation library compute with these colours, which a semantic colour can't do.
 */
export function navigationTheme(scheme: ColorSchemeName): Theme {
  const dark = scheme === 'dark';
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: dark ? GREEN.dark : GREEN.light,
      // systemGroupedBackground, as `colors.background` resolves it.
      background: dark ? '#000000' : '#f2f2f7',
    },
  };
}

/** Spacing steps, for margins, paddings and gaps. */
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** iOS text styles at the default Dynamic Type size, each with its colour. */
export const text = StyleSheet.create({
  title1: { fontSize: 28, fontWeight: '700', color: colors.label },
  title2: { fontSize: 22, fontWeight: '700', color: colors.label },
  title3: { fontSize: 20, fontWeight: '600', color: colors.label },
  headline: { fontSize: 17, fontWeight: '600', color: colors.label },
  body: { fontSize: 17, color: colors.label },
  subheadline: { fontSize: 15, color: colors.secondaryLabel },
  footnote: { fontSize: 13, color: colors.secondaryLabel },
  caption: { fontSize: 12, color: colors.secondaryLabel },
});

/** What a Pressable shows while pressed: a button fades, a row fills. */
export const pressedStyle = StyleSheet.create({
  button: { opacity: 0.5 },
  row: { backgroundColor: colors.fill },
});

/** Rows grouped on the background, as iOS Settings draws them. */
export const group = StyleSheet.create({
  /** A rounded group of rows, inset from the screen's edges. */
  box: {
    marginHorizontal: space.l,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  /** A row: at least a 44 pt target. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 44,
    paddingHorizontal: space.l,
    paddingVertical: space.s,
  },
  /** The hairline above every row of a group but its first. */
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  /** A group's title, above it. */
  header: {
    ...text.footnote,
    textTransform: 'uppercase',
    marginTop: space.xxl,
    marginBottom: space.s,
    marginHorizontal: space.xxxl,
  },
});
