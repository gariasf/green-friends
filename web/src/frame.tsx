import type { ReactNode } from 'react';

/**
 * The frame every screen shares (spec #72): breadcrumbs on a plant's pages, sections under a
 * sentence-case heading with a note on its right and a rule beneath, and a plain toggle.
 */

/** Where a plant's page sits: links back up, then where you are, as plain words. */
export function Breadcrumbs({ trail }: { trail: [label: string, href?: string][] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumbs">
      {trail.map(([label, href], index) => (
        <span key={label + index}>
          {index > 0 && <span aria-hidden="true"> / </span>}
          {href ? <a href={href}>{label}</a> : <span aria-current="page">{label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** A section: its heading, what it counts or says on the right, and a rule beneath both. */
export function Section({
  id,
  title,
  note,
  children,
}: {
  id?: string;
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section" id={id}>
      <header className="section-head">
        <h2>{title}</h2>
        {note && <span className="quiet">{note}</span>}
      </header>
      {children}
    </section>
  );
}

/** Two or three choices as a plain bordered toggle, the chosen one on the fill. */
export function Toggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [value: T, words: string][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="toggle" role="group" aria-label={label}>
      {options.map(([option, words]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {words}
        </button>
      ))}
    </div>
  );
}
