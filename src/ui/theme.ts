import { Color, DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { DynamicColorIOS, StyleSheet, type ColorSchemeName } from 'react-native';

// The palette (ticket #34): four colours from Sanzo Wada's A Dictionary of Color Combinations,
// their hex the naive conversion of the owner's CMYK, each but Olive Ocher with a dark shade.
/** Dark Medici Blue, the tint: 5.08:1 on white, 7.66:1 on the dark card. */
const MEDICI = { light: '#417777', dark: '#7fb8b8' };
/** Ecru. `assets/icon.svg` and app.json's splash repeat it and Medici's light shade. */
const ECRU = { light: '#c0b490', dark: '#3a3526' };

/**
 * The app's colours, the only ones it uses: iOS semantic colours, which follow light and dark
 * mode and Increase Contrast by themselves, the palette above, and two status colours in iOS's
 * shades. React Native draws text black unless told otherwise, so every Text takes its colour
 * from here, through `text`.
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
  tint: DynamicColorIOS(MEDICI),
  /** Text on a tint fill: 5.08:1 in light mode, 7.14:1 in dark. */
  onTint: DynamicColorIOS({ light: '#ffffff', dark: '#0e2626' }),
  /**
   * A warm ground behind a photo placeholder. Label reads 10.2:1 on it and secondaryLabel about
   * 5.3:1, but tint only 2.46:1 in light mode, so never tinted text. The placeholder's tinted leaf
   * is decorative and hidden from VoiceOver, the same pair as the app icon.
   */
  tintSoft: DynamicColorIOS(ECRU),
  /**
   * Destructive actions: iOS's systemRed, in light mode its Increase Contrast shade, since the
   * default reads about 3.5:1 on a card (ticket #30).
   */
  danger: DynamicColorIOS({ light: '#d70015', dark: '#ff453a', highContrastDark: '#ff6961' }),
  // The two status colours come from the palette, quieter than iOS's red and orange (ticket #34),
  // each at least 4.5:1 for a status line.
  /**
   * Overdue care and toxicity: Hay's Russet, 12.1:1 on white; its dark shade is lighter than the
   * repot hue's, 5.16:1 on the dark card.
   */
  caution: DynamicColorIOS({ light: '#681916', dark: '#d86f62', highContrastDark: '#e07d70' }),
  /** A pale caution, behind the toxicity badge: dark enough in dark mode for 4.5:1 with caution. */
  cautionSoft: DynamicColorIOS({ light: '#fdecea', dark: '#361a18' }),
  /** Care Due today: the tint, something to do rather than a warning. */
  dueToday: DynamicColorIOS(MEDICI),
  // Each kind of Care Event's hue, beside its symbol (CARE_COPY), always beside its words. Water
  // stays systemBlue, apart from the tint; fertilize is Olive Ocher, 1.91:1 on white like
  // systemYellow before it; repot is Hay's Russet, 4.04:1 on the dark card.
  water: Color.ios.systemBlue,
  fertilize: '#d1bd1a',
  repot: DynamicColorIOS({ light: '#681916', dark: '#c8594c' }),
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
      primary: dark ? MEDICI.dark : MEDICI.light,
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

/**
 * A 44 pt target by its own size, for a control that UIKit or SwiftUI hit-tests rather than React
 * Native, such as a header button or the view inside a MenuView: hitSlop past its edges can't be
 * counted on there.
 */
export const target = StyleSheet.create({
  text: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

/**
 * Whether text is at one of iOS's accessibility sizes, where a row of controls that fits at every
 * standard size runs out of room: xxxLarge scales text by 1.35, the first accessibility size by
 * 1.64.
 */
export function accessibilitySize(fontScale: number): boolean {
  return fontScale > 1.5;
}

/** What a Pressable shows while pressed: a button fades, a row fills. */
export const pressedStyle = StyleSheet.create({
  button: { opacity: 0.5 },
  row: { backgroundColor: colors.fill },
});

/**
 * Rows grouped on the background in iOS 26's grouped style, as Settings' SwiftUI Form draws them
 * (ticket #32), so the lists React Native draws look alike.
 */
export const group = StyleSheet.create({
  /** A rounded group of rows, inset from the screen's edges. */
  box: {
    marginHorizontal: space.l,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  /** The hairline above every row of a group but its first. */
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  /** A section's heading, in sentence case, placed by its screen in line with what it heads. */
  header: { ...text.headline, color: colors.secondaryLabel },
});
