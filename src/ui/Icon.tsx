import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
// One file per icon: the package's index pulls in all of Phosphor, which Metro doesn't tree-shake.
import { ArchiveIcon } from 'phosphor-react-native/src/icons/Archive';
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen';
import { BugIcon } from 'phosphor-react-native/src/icons/Bug';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CircleIcon } from 'phosphor-react-native/src/icons/Circle';
import { ClockCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ClockCounterClockwise';
import { DotsThreeIcon } from 'phosphor-react-native/src/icons/DotsThree';
import { DropIcon } from 'phosphor-react-native/src/icons/Drop';
import { FlaskIcon } from 'phosphor-react-native/src/icons/Flask';
import { LeafIcon } from 'phosphor-react-native/src/icons/Leaf';
import { LightbulbIcon } from 'phosphor-react-native/src/icons/Lightbulb';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { NotePencilIcon } from 'phosphor-react-native/src/icons/NotePencil';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { SealCheckIcon } from 'phosphor-react-native/src/icons/SealCheck';
import { ShovelIcon } from 'phosphor-react-native/src/icons/Shovel';
import { StackIcon } from 'phosphor-react-native/src/icons/Stack';
import { StethoscopeIcon } from 'phosphor-react-native/src/icons/Stethoscope';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { XCircleIcon } from 'phosphor-react-native/src/icons/XCircle';
import { View, type ColorValue } from 'react-native';

/**
 * The app's icons, from Phosphor (MIT, spec #57), named by what they mean rather than what they
 * draw, so a screen says "water" and the drawing can change here. The Web view's `web/src/icons.tsx`
 * keeps the same mapping.
 */
const ICONS = {
  water: DropIcon,
  fertilize: FlaskIcon,
  repot: ShovelIcon,
  note: NotePencilIcon,
  leaf: LeafIcon,
  archive: ArchiveIcon,
  check: CheckIcon,
  checkCircle: CheckCircleIcon,
  circle: CircleIcon,
  next: CaretRightIcon,
  history: ClockCounterClockwiseIcon,
  add: PlusIcon,
  more: DotsThreeIcon,
  clear: XCircleIcon,
  search: MagnifyingGlassIcon,
  allDone: SealCheckIcon,
  light: SunIcon,
  guide: BookOpenIcon,
  symptom: StethoscopeIcon,
  pest: BugIcon,
  soil: StackIcon,
  fact: LightbulbIcon,
  schedule: CalendarBlankIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

/** Care types draw filled, in their hue: the one place colour carries meaning. */
const FILLED = new Set<IconName>(['water', 'fertilize', 'repot', 'note']);

/**
 * An icon beside its own words, so VoiceOver skips it: an icon-only control labels its Pressable
 * instead.
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
