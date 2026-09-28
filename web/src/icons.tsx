import {
  BugIcon,
  CaretRightIcon,
  DropIcon,
  FlaskIcon,
  LeafIcon,
  LightbulbIcon,
  NotePencilIcon,
  ShovelIcon,
  StackIcon,
  StethoscopeIcon,
  SunIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

import type { CareEventType } from '../../src/core/careLog';
import { framePosition, type Focus } from '../../src/core/photos';

/**
 * A care type's icon, filled in its hue, as the phone's `Icon` draws it (src/ui/Icon.tsx, spec #57).
 * Always beside its words, so screen readers skip it.
 */
export function CareIcon({ type, size = 18 }: { type: CareEventType; size?: number }) {
  const Drawn = CARE_ICONS[type];
  return <Drawn className={`care-icon ${type}`} size={size} weight="fill" aria-hidden="true" />;
}

const CARE_ICONS: Record<CareEventType, PhosphorIcon> = {
  water: DropIcon,
  fertilize: FlaskIcon,
  repot: ShovelIcon,
  note: NotePencilIcon,
};

/**
 * A photo's `object-position` in a frame of `frameAspect` (width over height) it covers: on its
 * Focal point, as the phone frames it (framePosition, spec #67).
 */
export function objectPosition(focus: Focus | null, frameAspect: number): string {
  const { x, y } = framePosition(focus, frameAspect);
  return `${x * 100}% ${y * 100}%`;
}

/**
 * A plant's photo, decorative beside its name as on the phone unless given `alt`, or the phone's
 * placeholder while it has none: the name's initial in Young Serif, tinted, on Ecru. `size` is its
 * class: 20, 40 or 64 px, or `cell`, a Garden grid cell's width.
 */
export function Thumb({
  src,
  focus = null,
  name,
  size = 'md',
  alt = '',
}: {
  src: string | undefined;
  focus?: Focus | null;
  name: string;
  size?: 'xs' | 'md' | 'lg' | 'cell';
  alt?: string;
}) {
  if (src) {
    return (
      <img
        className={`thumb ${size}`}
        src={src}
        alt={alt}
        style={{ objectPosition: objectPosition(focus, 1) }}
      />
    );
  }
  return (
    <span className={`thumb ${size} initial`} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * The app icon's mark (`assets/icon.svg`, ticket #29): three leaves rising from behind a pot's rim,
 * in the tint on an Ecru plate. The icon's cut-outs are the plate's colour here, not a mask.
 */
export function AppMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="app-mark" width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
      <rect className="plate" width="1024" height="1024" rx="230" />
      <g transform="translate(-10.24 -37.24) scale(1.02)">
        <g className="mark">
          <path d="M512 630 C380 505.2 424 330.5 512 214 C600 330.5 644 505.2 512 630Z" />
          <path d="M498 630 C356.5 660.6 274.7 551.6 250 440 C372.3 424.2 502.9 469.5 498 630Z" />
          <path d="M526 630 C521.6 470.1 652 424.6 774 440 C749.6 552 668 661.2 526 630Z" />
          <rect x="336" y="612" width="352" height="74" rx="20" />
          <path d="M362 680 H662 L634 842 Q630 864 608 864 H416 Q394 864 390 842 Z" />
        </g>
        <rect className="plate" x="316" y="592" width="392" height="20" />
        <g className="cut">
          <path d="M512 521.8 L512 305.5" />
          <path d="M423.6 573 L309.5 485.6" />
          <path d="M600.4 573 L714.5 485.6" />
        </g>
      </g>
    </svg>
  );
}

/**
 * The Care Guide's icons, as the phone's: Regular, in Olive Ocher for the sun (the app's
 * `colors.sun`), the tint or grey. Always beside their words, so screen readers skip them.
 */
export function GuideIcon({ name, size = 18 }: { name: keyof typeof GUIDE_ICONS; size?: number }) {
  const Drawn = GUIDE_ICONS[name];
  return (
    <Drawn className={`care-icon guide-${name}`} size={size} weight="regular" aria-hidden="true" />
  );
}

const GUIDE_ICONS = {
  light: SunIcon,
  soil: StackIcon,
  symptom: StethoscopeIcon,
  leaf: LeafIcon,
  pest: BugIcon,
  fact: LightbulbIcon,
  next: CaretRightIcon,
} satisfies Record<string, PhosphorIcon>;
