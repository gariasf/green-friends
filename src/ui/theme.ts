import { Color, DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { DynamicColorIOS, StyleSheet, type ColorSchemeName } from 'react-native';

// The palette (ticket #34): four colours from Sanzo Wada's A Dictionary of Color Combinations,
// their hex the naive conversion of the owner's CMYK, each but Olive Ocher with a dark shade.
/** Dark Medici Blue, the tint: 5.08:1 on white, 7.66:1 on the dark card. */
const MEDICI = { light: '#417777', dark: '#7fb8b8' };
/** Ecru. `assets/icon.svg` and app.json's splash repeat it and Medici's light shade. */
const ECRU = { light: '#c0b490', dark: '#3a3526' };
/** Olive Ocher, one shade for both modes. */
const OLIVE = '#d1bd1a';

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
  fertilize: OLIVE,
  repot: DynamicColorIOS({ light: '#681916', dark: '#c8594c' }),
  note: Color.ios.systemGray,
  /**
   * Light's sun in the Care Guide and its marked step on the light scale: Olive Ocher, the
   * palette's sunny hue, shared with fertilize; never caution, which would read as a warning.
   */
  sun: OLIVE,
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

/**
 * The app's faces, embedded by expo-font's config plugin (app.json), one static face per weight:
 * SDK 57 draws no variable font. Nunito Sans (SIL OFL) for the text, as the Web view (spec #41),
 * and Young Serif (SIL OFL), which has one weight, for the titles (spec #57). React Native finds a
 * face by family, weight and style; a PostScript name as the family falls back to the regular face
 * and drops the italic. SwiftUI and UIKit controls keep the system font.
 */
const NUNITO = 'Nunito Sans';
const YOUNG_SERIF = 'Young Serif';
export const font = {
  regular: { fontFamily: NUNITO, fontWeight: '400' },
  italic: { fontFamily: NUNITO, fontWeight: '400', fontStyle: 'italic' },
  semibold: { fontFamily: NUNITO, fontWeight: '600' },
  bold: { fontFamily: NUNITO, fontWeight: '700' },
  title: { fontFamily: YOUNG_SERIF, fontWeight: '400' },
} as const;

/**
 * The type scale at the default Dynamic Type size, each with its colour: six steps, sized as the
 * Web view's where they can be (28, 22, 15, 13), in set B's weights (ticket #54): SemiBold 600 for
 * what stands out, Regular 400 for the rest. The titles are Young Serif in its one weight (spec
 * #57); the tiles' values keep title2's size in Nunito Bold 700, which the owner preferred there.
 *
 *   step         size  face         use
 *   large title  34    Young Serif  a tab's navigation bar (Today, Garden, Settings)
 *   nav title    17    Nunito 600   a pushed screen's or a sheet's navigation bar
 *   title1       28    Young Serif  a plant's name on its screen
 *   title2       22    Young Serif  a sheet's title, a Care Guide card's heading, a cause's name,
 *                                   an empty state; a tile's value in Nunito 700 (font.bold)
 *   headline     17    Nunito 600   plant names in a card, section headings, a button's label
 *   body         17    Nunito 400   everything else
 *   subheadline  15    Nunito 400   second lines; 600 (font.semibold) for a care row's label
 *   footnote     13    Nunito 400   statuses, badges and "Last …" lines; 600 where they stand out
 */
export const text = StyleSheet.create({
  title1: { ...font.title, fontSize: 28, color: colors.label },
  title2: { ...font.title, fontSize: 22, color: colors.label },
  headline: { ...font.semibold, fontSize: 17, color: colors.label },
  body: { ...font.regular, fontSize: 17, color: colors.label },
  subheadline: { ...font.regular, fontSize: 15, color: colors.secondaryLabel },
  footnote: { ...font.regular, fontSize: 13, color: colors.secondaryLabel },
});

/** A navigation bar's titles in the app's type: every Stack's screenOptions spread these. */
export const headerFonts = {
  headerTitleStyle: font.semibold,
  headerLargeTitleStyle: font.title,
} as const;

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
