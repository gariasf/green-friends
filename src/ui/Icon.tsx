import {
  Archive,
  BookOpen,
  Bug,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  CircleIcon,
  ClockCounterClockwise,
  DotsThree,
  Drop,
  Flask,
  Leaf,
  Lightbulb,
  MagnifyingGlass,
  NotePencil,
  PawPrint,
  Plus,
  PottedPlant,
  SealCheck,
  Shovel,
  Stack,
  Stethoscope,
  Sun,
  XCircle,
  type IconWeight,
  type Icon as PhosphorIcon,
} from 'phosphor-react-native';
import { View, type ColorValue } from 'react-native';

/**
 * PROTOTYPE (type and icons): the app's icons, from Phosphor (MIT), by what they mean rather than
 * what they draw, so a screen says "water" and the drawing can change in one place.
 */
const ICONS = {
  water: Drop,
  fertilize: Flask,
  repot: Shovel,
  note: NotePencil,
  plant: PottedPlant,
  leaf: Leaf,
  pet: PawPrint,
  archive: Archive,
  check: Check,
  checkCircle: CheckCircle,
  circle: CircleIcon,
  next: CaretRight,
  previous: CaretLeft,
  history: ClockCounterClockwise,
  add: Plus,
  more: DotsThree,
  clear: XCircle,
  search: MagnifyingGlass,
  allDone: SealCheck,
  light: Sun,
  guide: BookOpen,
  symptom: Stethoscope,
  pest: Bug,
  soil: Stack,
  fact: Lightbulb,
  schedule: CalendarBlank,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

/** Care types always draw filled, in their hue: the one place colour carries meaning. */
const FILLED = new Set<IconName>(['water', 'fertilize', 'repot', 'note']);

/**
 * An icon beside its own words, so screen readers skip it: an icon-only control labels its
 * Pressable instead.
 */
export function Icon({
  name,
  size,
  color,
  weight,
}: {
  name: IconName;
  size: number;
  color: ColorValue;
  weight?: IconWeight;
}) {
  const Drawn = ICONS[name];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* react-native-svg takes iOS's dynamic colours, which Phosphor's string type doesn't say. */}
      <Drawn
        size={size}
        color={color as string}
        weight={weight ?? (FILLED.has(name) ? 'fill' : 'regular')}
      />
    </View>
  );
}
