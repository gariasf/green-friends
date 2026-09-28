import { seasonOn, type SeasonOn } from '../../src/core/care';
import {
  CARE_GUIDES_LIGHT,
  causeFact,
  symptomCauses,
  type CareGuide,
  type CareProfile,
  type SeasonalSchedule,
} from '../../src/core/careGuide';
import type { Settings } from '../../src/core/settings';
import {
  ALL_YEAR,
  CAUSE_COLUMNS,
  causeFactLine,
  causesIntro,
  everyLine,
  HOW_TO_WATER,
  lightLabel,
  lightWords,
  NO_CARE_GUIDE,
  NO_SCHEDULE_LINE,
  NOT_IN_YOUR_GARDEN,
  npkNote,
  PAUSED,
  PET_WARNING,
  SYMPTOM_GROUPS,
  SYMPTOMS_TITLE,
} from '../../src/ui/words';
import { guides } from '../../src/ui/guides';
import type { Garden } from './garden';
import { Breadcrumbs, Section } from './frame';
import { CareIcon, GuideIcon } from './icons';

/**
 * The Care Guide in the Web view (spec #48, #72), read-only: its section on the plant's page, the
 * Symptoms and one Symptom, each at the plant's address plus `/symptoms` or `/symptom/<id>`. The
 * text is the bundled `assets/care-guides.json`.
 */

/** What a plant's page shows: the plant (`guide` scrolled to its Care Guide), or its Symptoms. */
export type PlantView =
  { page: 'plant' | 'guide' | 'symptoms' } | { page: 'symptom'; symptomId: string };

type Season = SeasonOn['season'];

/** The months each Season runs in a garden, "Mar – Oct" / "Nov – Feb", or all year and never. */
export function seasonMonths(
  settings: Pick<Settings, 'growingStartMonth' | 'growingEndMonth'>,
  restsInSummer: boolean,
): Record<Season, string> {
  const growing = Array.from(
    { length: 12 },
    (_, month) =>
      seasonOn(`2026-${String(month + 1).padStart(2, '0')}-15`, settings, restsInSummer).season ===
      'growing',
  );
  if (growing.every(Boolean)) return { growing: ALL_YEAR, dormant: NOT_IN_YOUR_GARDEN };
  const name = (month: number) =>
    new Date(2026, month, 15).toLocaleDateString(undefined, { month: 'short' });
  const first = growing.findIndex((on, month) => on && !growing[(month + 11) % 12]);
  const last = growing.findIndex((on, month) => on && !growing[(month + 1) % 12]);
  return {
    growing: `${name(first)} – ${name(last)}`,
    dormant: `${name((last + 1) % 12)} – ${name((first + 11) % 12)}`,
  };
}

const SEASONS = [
  ['growing', 'Growing'],
  ['dormant', 'Dormant'],
] as const;

/**
 * The plant's Care Guide, with nothing to switch: Water and Feed by Season in two columns, each with
 * the plant's interval and today's marked Now, then the rest in a fixed grid. Without a profile,
 * the nudge.
 */
export function GuideSection({
  guide,
  months,
}: {
  guide: CareGuide | null;
  months: Record<Season, string>;
}) {
  if (!guide) {
    return (
      <Section id="care-guide" title="Care Guide">
        <p>
          <strong>{NO_CARE_GUIDE.title}</strong>
        </p>
        <p className="quiet">{NO_CARE_GUIDE.line}</p>
      </Section>
    );
  }
  const { profile, schedule } = guide;
  const now = guide.season.season;
  const npk = npkNote(profile.fertilizer.type);
  const rows = [
    ['water', 'Water', profile.watering, schedule.water],
    ['fertilize', 'Feed', profile.fertilizer, schedule.fertilize],
  ] as const;
  return (
    <Section id="care-guide" title="Care Guide" note={profile.name}>
      <table className="seasons">
        <thead>
          <tr>
            <td />
            {SEASONS.map(([season, label]) => (
              <th key={season} scope="col" className={season === now ? 'now' : undefined}>
                <strong>{label}</strong>
                <span className="quiet">{months[season]}</span>
                {season === now && <span className="now-pill">Now</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([type, label, advice, interval]) => (
            <tr key={type}>
              <th scope="row">
                <CareIcon type={type} />
                {label}
              </th>
              {SEASONS.map(([season]) => (
                <td key={season} className={season === now ? 'now' : undefined}>
                  {advice[season]}
                  <strong className="every">{seasonInterval(interval, season)}</strong>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="guide-grid">
        <section>
          <h3>
            <CareIcon type="water" />
            {HOW_TO_WATER}
          </h3>
          <p>{profile.watering.how}</p>
        </section>
        <section>
          <h3>
            <CareIcon type="fertilize" />
            Fertiliser
          </h3>
          <p>{profile.fertilizer.type}</p>
          {npk && <p className="quiet">{npk}</p>}
        </section>
        <section>
          <h3>
            <GuideIcon name="light" />
            Light and warmth
          </h3>
          <LightScale light={profile.light} />
          <p>{profile.light.text}</p>
        </section>
        <section>
          <h3>
            <GuideIcon name="soil" />
            Soil
          </h3>
          <p>{profile.soil}</p>
        </section>
        {guide.careNotes && (
          <section className="wide">
            <h3>
              <GuideIcon name="leaf" />
              This plant
            </h3>
            <p>{guide.careNotes}</p>
          </section>
        )}
        <section className="wide fact">
          <h3>
            <GuideIcon name="fact" />
            Fun fact
          </h3>
          <p>
            {guide.funFact.text}{' '}
            <a className="link" href={guide.funFact.source} target="_blank" rel="noreferrer">
              More on Wikipedia
            </a>
          </p>
        </section>
      </div>
    </Section>
  );
}

/** A seasonal interval in one Season: "Every 14 days", Paused, or no schedule at all. */
export function seasonInterval(interval: SeasonalSchedule, season: Season): string {
  if (interval.growing === null) return NO_SCHEDULE_LINE;
  const days = interval[season];
  return days === null ? PAUSED : everyLine(days, 'day');
}

/** The shared light scale with this profile's step filled in, and its step and direct sun in words. */
function LightScale({ light }: { light: CareProfile['light'] }) {
  return (
    <span className="scale" role="img" aria-label={lightLabel(light)}>
      <span className="steps" aria-hidden="true">
        {CARE_GUIDES_LIGHT.level.map((level) => (
          <span key={level} className={level === light.level ? 'marked' : undefined} />
        ))}
      </span>
      <span className="quiet" aria-hidden="true">
        {lightWords(light).join(' · ')}
      </span>
    </span>
  );
}

/** What can be seen going wrong: leaves and stems beside pests. */
export function SymptomsView({ id, name }: { id: string; name: string }) {
  return (
    <>
      <Breadcrumbs trail={[['Garden', '#/garden'], [name, `#/plant/${id}`], [SYMPTOMS_TITLE]]} />
      <header className="page-head">
        <h1 tabIndex={-1}>{SYMPTOMS_TITLE}</h1>
      </header>
      <div className="symptom-groups">
        {SYMPTOM_GROUPS.map(({ kind, title }) => (
          <Section key={kind} title={title}>
            <ul className="links">
              {guides.symptoms
                .filter((symptom) => symptom.kind === kind)
                .map((symptom) => (
                  <li key={symptom.id}>
                    <a href={`#/plant/${id}/symptom/${symptom.id}`}>
                      <GuideIcon name={kind === 'pest' ? 'pest' : 'leaf'} />
                      <span className="grow">{symptom.name}</span>
                      <GuideIcon name="next" size={14} />
                    </a>
                  </li>
                ))}
            </ul>
          </Section>
        ))}
      </div>
    </>
  );
}

/**
 * One Symptom: its causes, the profile's typical ones first, each a row of what it is (with what
 * the Care Log says), how to tell and what to do. Read-only, so nothing to log.
 */
export function SymptomView({
  garden,
  id,
  name,
  symptomId,
  profile,
  today,
}: {
  garden: Garden;
  id: string;
  name: string;
  symptomId: string;
  profile: CareProfile | null;
  today: string;
}) {
  const symptom = guides.symptoms.find((candidate) => candidate.id === symptomId);
  if (!symptom) return <SymptomsView id={id} name={name} />;
  return (
    <>
      <Breadcrumbs
        trail={[
          ['Garden', '#/garden'],
          [name, `#/plant/${id}`],
          [SYMPTOMS_TITLE, `#/plant/${id}/symptoms`],
          [symptom.name],
        ]}
      />
      <header className="page-head">
        <h1 tabIndex={-1}>{symptom.name}</h1>
        <p className="quiet">{causesIntro(profile)}</p>
      </header>
      <table className="causes">
        <thead>
          <tr>
            {CAUSE_COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symptomCauses(symptom, profile).map((causeId) => {
            const cause = guides.causes[causeId];
            return (
              <tr key={causeId}>
                <th scope="row">
                  <strong>{cause.name}</strong>
                  {cause.fact && (
                    <span className="quiet">
                      {causeFactLine(causeFact(garden.db, id, cause.fact, today), today)}
                    </span>
                  )}
                </th>
                <td data-column={CAUSE_COLUMNS[1]}>{cause.tell}</td>
                <td data-column={CAUSE_COLUMNS[2]}>
                  {cause.fix}
                  {cause.petWarning && <span className="pet-warning">{PET_WARNING}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
