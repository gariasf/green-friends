import type { CareEventType } from '../../src/core/careLog';

/**
 * A care type's symbol in its hue, drawn after the SF Symbol the app shows (CARE_COPY: drop.fill,
 * sparkles, shippingbox.fill, note.text). Always beside its words, so screen readers skip it.
 */
export function CareIcon({ type, size = 18 }: { type: CareEventType; size?: number }) {
  return (
    <svg
      className={`care-icon ${type}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {type === 'water' && <path d="M12 2.5S5 10.4 5 14.8a7 7 0 0 0 14 0C19 10.4 12 2.5 12 2.5z" />}
      {type === 'fertilize' && (
        <>
          <path d="M10 3l1.9 5.6 5.6 1.9-5.6 1.9L10 18l-1.9-5.6-5.6-1.9 5.6-1.9z" />
          <path d="M18 13l.9 2.6 2.6.9-2.6.9L18 20l-.9-2.6-2.6-.9 2.6-.9z" />
          <path d="M18.5 2l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" />
        </>
      )}
      {type === 'repot' && (
        <>
          <path d="M12 2.8l8.5 3.8L12 10.4 3.5 6.6z" />
          <path d="M3 8.2l8.2 3.7V21L3 17.3zM21 8.2l-8.2 3.7V21l8.2-3.7z" />
        </>
      )}
      {type === 'note' && (
        <path
          fillRule="evenodd"
          d="M6 2.5h12A2.5 2.5 0 0 1 20.5 5v14a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 19V5A2.5 2.5 0 0 1 6 2.5zM7 7v1.6h10V7zm0 4.2v1.6h10v-1.6zm0 4.2V17h6.5v-1.6z"
        />
      )}
    </svg>
  );
}

/**
 * A plant's photo, decorative beside its name as on the phone unless given `alt`, or the app's
 * placeholder while it has none: a tinted leaf (leaf.fill) on Ecru. `size` is its class: 40, 64
 * or 88 px.
 */
export function Thumb({
  src,
  size = 'md',
  alt = '',
}: {
  src: string | undefined;
  size?: 'md' | 'lg' | 'xl';
  alt?: string;
}) {
  if (src) return <img className={`thumb ${size}`} src={src} alt={alt} />;
  return (
    <span className={`thumb ${size} leaf`} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4.5 19.5C4.5 10 10.5 4.5 20 4.5c0 9.5-5.5 15.5-15 15.5z" />
        <path className="vein" d="M4.5 19.5L14 10" />
      </svg>
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
 * The Care Guide's symbols, drawn after the SF Symbols the app shows: sun.max.fill (Olive Ocher, as
 * the app's `colors.sun`), square.stack.3d.up.fill, book.fill, stethoscope, leaf.fill, ant.fill,
 * lightbulb.fill and pawprint.fill. Always beside their words, so screen readers skip them.
 */
export function GuideIcon({
  name,
  size = 18,
}: {
  name: 'sun' | 'soil' | 'guide' | 'wrong' | 'leaf' | 'pest' | 'fact' | 'paw';
  size?: number;
}) {
  return (
    <svg
      className={`care-icon guide-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {name === 'sun' && (
        <>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M11 1.5h2v4h-2zM11 18.5h2v4h-2zM1.5 11h4v2h-4zM18.5 11h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8-1.4 1.4zM15.6 17l1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4l2.8-2.8 1.4 1.4-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4-2.8 2.8z" />
        </>
      )}
      {name === 'soil' && (
        <>
          <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
          <path d="M3 11.5l9 4.5 9-4.5v2.2l-9 4.5-9-4.5zM3 15.8l9 4.5 9-4.5V18l-9 4.5L3 18z" />
        </>
      )}
      {name === 'guide' && (
        <path d="M2 5c3-1.5 6.5-1.5 9 .5V20c-2.5-2-6-2-9-.5zM22 5c-3-1.5-6.5-1.5-9 .5V20c2.5-2 6-2 9-.5z" />
      )}
      {name === 'wrong' && (
        <path
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          d="M6 3v6a4 4 0 0 0 8 0V3M10 13v3a4 4 0 0 0 8 0v-2M18 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
        />
      )}
      {name === 'leaf' && <path d="M4.5 19.5C4.5 10 10.5 4.5 20 4.5c0 9.5-5.5 15.5-15 15.5z" />}
      {name === 'pest' && (
        <>
          <circle cx="12" cy="6" r="2.5" />
          <ellipse cx="12" cy="11.5" rx="2.5" ry="3" />
          <ellipse cx="12" cy="18" rx="3.5" ry="4" />
          <path d="M4 9l4 2-.6 1.2-4-2zM20 9l-4 2 .6 1.2 4-2zM3.5 17l4-1.5.5 1.3-4 1.5zM20.5 17l-4-1.5-.5 1.3 4 1.5z" />
        </>
      )}
      {name === 'fact' && (
        <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 18.5h6V20a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
      )}
      {name === 'paw' && (
        <>
          <ellipse cx="12" cy="16.5" rx="5" ry="4.5" />
          <circle cx="5" cy="10.5" r="2.2" />
          <circle cx="9" cy="5.5" r="2.2" />
          <circle cx="15" cy="5.5" r="2.2" />
          <circle cx="19" cy="10.5" r="2.2" />
        </>
      )}
    </svg>
  );
}
