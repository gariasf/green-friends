// PROTOTYPE (prototype/web-design): throwaway, never merged. See variants.tsx.
import type { CareEventType } from '../../../src/core/careLog';

/** The app's care symbols (SF Symbols drop.fill, sparkles, shippingbox.fill, note.text) drawn as SVG, in their hue. */
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
          <path d="M10 3l1.9 5.6L17.5 10.5l-5.6 1.9L10 18l-1.9-5.6L2.5 10.5l5.6-1.9z" />
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

/** The photo placeholder, as the app's: a tinted leaf on Ecru. */
export function Leaf({ className = '' }: { className?: string }) {
  return (
    <span className={`leaf ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4.5 19.5C4.5 10 10.5 4.5 20 4.5c0 9.5-5.5 15.5-15 15.5z" />
        <path className="vein" d="M4.5 19.5L14 10" />
      </svg>
    </span>
  );
}

/** A plant's photo or the leaf, square. */
export function Thumb({ src, className = '' }: { src: string | undefined; className?: string }) {
  return src ? (
    <img className={`thumb ${className}`} src={src} alt="" />
  ) : (
    <Leaf className={`thumb ${className}`} />
  );
}

/** The app icon's mark: the potted plant (#29, C). */
export function AppMark({ size = 28 }: { size?: number }) {
  return (
    <span className="app-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path
          className="leaves"
          d="M12 13c-.3-3.2-2.2-5.8-5.5-6.8.2 3.6 2.4 6.2 5.5 6.8zm0 0c.3-3.2 2.2-5.8 5.5-6.8-.2 3.6-2.4 6.2-5.5 6.8zm0 0c-1-2.8-.7-5.8 0-8.5.7 2.7 1 5.7 0 8.5z"
        />
        <path className="pot" d="M6.5 13.5h11l-1.4 7h-8.2z" />
      </svg>
    </span>
  );
}
