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
 * A plant's photo, decorative beside its name as on the phone, or the app's placeholder while it
 * has none: a tinted leaf (leaf.fill) on Ecru. `size` is its class: 40, 64 or 88 px.
 */
export function Thumb({
  src,
  size = 'md',
}: {
  src: string | undefined;
  size?: 'md' | 'lg' | 'xl';
}) {
  if (src) return <img className={`thumb ${size}`} src={src} alt="" />;
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
