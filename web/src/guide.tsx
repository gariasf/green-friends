import { useState } from 'react';

import type { SeasonOn } from '../../src/core/care';
import {
  CARE_GUIDES_LIGHT,
  causeFact,
  symptomCauses,
  type CareGuide,
  type CareProfile,
} from '../../src/core/careGuide';
import {
  causeFactLine,
  causesIntro,
  feedLine,
  LIGHT_WORDS,
  lightLabel,
  NO_CARE_GUIDE,
  PET_WARNING,
  seasonLine,
  SOMETHING_WRONG,
  SYMPTOM_GROUPS,
  SYMPTOMS_TITLE,
  yourSchedule,
} from '../../src/ui/words';
import { guides } from '../../src/ui/guides';
import type { Garden } from './garden';
import { CareIcon, GuideIcon } from './icons';

/**
 * The Care Guide as the phone's (spec #48, #51), read-only: the Plant pane's Care group, the full
 * Care Guide, the Symptoms and one Symptom, each in the detail pane at the plant's address plus
 * `/guide`, `/symptoms` or `/symptom/<id>`. The text is the bundled `assets/care-guides.json`.
 */

/** What the chosen plant's pane shows: the plant, or one of its Care Guide's pages. */
export type PlantView =
  { page: 'plant' | 'guide' | 'symptoms' } | { page: 'symptom'; symptomId: string };

type Season = SeasonOn['season'];

/** The Plant pane's Care group, under its care summary; without a profile, the nudge. */
export function CareRows({
  id,
  guide,
  season,
  today,
}: {
  id: string;
  guide: CareGuide | null;
  season: SeasonOn;
  today: string;
}) {
  const profile = guide?.profile;
  const now = season.season;
  return (
    <>
      <h2>Care Guide · {seasonLine(season, today)}</h2>
      <ul className="group guide-rows">
        {profile ? (
          <>
            <li>
              <CareIcon type="water" />
              <span className="grow">
                <strong>Water</strong>
                <span className="quiet">{profile.watering[now]}</span>
              </span>
            </li>
            <li>
              <CareIcon type="fertilize" />
              <span className="grow">
                <strong>Feed</strong>
                <span className="quiet">{feedLine(profile, now)}</span>
              </span>
            </li>
            <li>
              <GuideIcon name="sun" />
              <span className="grow">
                {/* The scale's label starts "Light:", so a screen reader hears it once. */}
                <strong aria-hidden="true">Light</strong>
                <LightScale light={profile.light} />
              </span>
            </li>
            <li>
              <a href={`#/plant/${id}/guide`}>
                <GuideIcon name="guide" />
                <strong className="grow">Full Care Guide</strong>
                <Chevron />
              </a>
            </li>
          </>
        ) : (
          <li>
            <GuideIcon name="leaf" />
            <span className="grow">
              <strong>{NO_CARE_GUIDE.title}</strong>
              <span className="quiet">{NO_CARE_GUIDE.line}</span>
            </span>
          </li>
        )}
        <SomethingWrong id={id} />
      </ul>
    </>
  );
}

function SomethingWrong({ id }: { id: string }) {
  return (
    <li>
      <a href={`#/plant/${id}/symptoms`}>
        <GuideIcon name="wrong" />
        <span className="grow">
          <strong>Something wrong?</strong>
          <span className="quiet">{SOMETHING_WRONG}</span>
        </span>
        <Chevron />
      </a>
    </li>
  );
}

function Chevron() {
  return (
    <span className="chevron" aria-hidden="true">
      ›
    </span>
  );
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
        {LIGHT_WORDS.level[light.level]} · {LIGHT_WORDS.directSun[light.directSun]}
      </span>
    </span>
  );
}

/**
 * The full Care Guide: the profile and today's Season, a Growing | Dormant switch opening on
 * today's, then watering and fertiliser with the plant's real schedule, light and warmth, soil,
 * its care notes, Something wrong? and its Fun fact.
 */
export function GuideView({
  id,
  name,
  guide,
  today,
}: {
  id: string;
  name: string;
  guide: CareGuide;
  today: string;
}) {
  const [season, setSeason] = useState<Season>(guide.season.season);
  const { profile, schedule } = guide;
  return (
    <>
      <BackToPlant id={id} name={name} />
      <h1 tabIndex={-1}>Care Guide</h1>
      <p className="quiet">
        {profile.name} · {seasonLine(guide.season, today)}
      </p>
      <div className="switch" role="group" aria-label="Season">
        {(['growing', 'dormant'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={season === option}
            onClick={() => setSeason(option)}
          >
            {option === 'growing' ? 'Growing' : 'Dormant'}
          </button>
        ))}
      </div>

      <section className="guide-card">
        <h2>
          <CareIcon type="water" />
          Watering
        </h2>
        <p>{profile.watering[season]}</p>
        <p>{profile.watering.how}</p>
        <p className="quiet">{yourSchedule(schedule.water)}</p>
      </section>

      <section className="guide-card">
        <h2>
          <CareIcon type="fertilize" />
          Fertiliser
        </h2>
        <p>
          <strong>{profile.fertilizer.type}</strong>
        </p>
        <p>{profile.fertilizer[season]}</p>
        <p className="quiet">{yourSchedule(schedule.fertilize)}</p>
      </section>

      <section className="guide-card">
        <h2>
          <GuideIcon name="sun" />
          Light and warmth
        </h2>
        <LightScale light={profile.light} />
        <p>{profile.light.text}</p>
      </section>

      <section className="guide-card">
        <h2>
          <GuideIcon name="soil" />
          Soil
        </h2>
        <p>{profile.soil}</p>
      </section>

      {guide.careNotes && (
        <section className="guide-card">
          <h2>
            <GuideIcon name="leaf" />
            This plant
          </h2>
          <p>{guide.careNotes}</p>
        </section>
      )}

      <ul className="group guide-rows">
        <SomethingWrong id={id} />
      </ul>

      <section className="guide-card">
        <h2>
          <GuideIcon name="fact" />
          Fun fact
        </h2>
        <p>{guide.funFact.text}</p>
        <p>
          <a className="link" href={guide.funFact.source} target="_blank" rel="noreferrer">
            More on Wikipedia
          </a>
        </p>
      </section>
    </>
  );
}

/** What can be seen going wrong: leaves and stems, then pests. */
export function SymptomsView({ id, name }: { id: string; name: string }) {
  return (
    <>
      <BackToPlant id={id} name={name} />
      <h1 tabIndex={-1}>{SYMPTOMS_TITLE}</h1>
      {SYMPTOM_GROUPS.map(({ kind, title }) => (
        <section key={kind}>
          <h2>{title}</h2>
          <ul className="group guide-rows">
            {guides.symptoms
              .filter((symptom) => symptom.kind === kind)
              .map((symptom) => (
                <li key={symptom.id}>
                  <a href={`#/plant/${id}/symptom/${symptom.id}`}>
                    <GuideIcon name={kind === 'pest' ? 'pest' : 'leaf'} />
                    <strong className="grow">{symptom.name}</strong>
                    <Chevron />
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/**
 * One Symptom: its causes, the profile's typical ones first, each with what the Care Log says
 * beside it, how to tell and what to do. Read-only, so nothing to log.
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
      <a className="back-plant" href={`#/plant/${id}/symptoms`}>
        ‹ {SYMPTOMS_TITLE}
      </a>
      <h1 tabIndex={-1}>{symptom.name}</h1>
      <p className="quiet">{causesIntro(profile)}</p>
      {symptomCauses(symptom, profile).map((causeId) => {
        const cause = guides.causes[causeId];
        return (
          <section key={causeId} className="guide-card">
            <h3>{cause.name}</h3>
            {cause.fact && (
              <p className="fact quiet">
                {causeFactLine(causeFact(garden.db, id, cause.fact, today), today)}
              </p>
            )}
            <h4>How to tell</h4>
            <p>{cause.tell}</p>
            <h4>What to do</h4>
            <p>{cause.fix}</p>
            {cause.petWarning && (
              <p className="pet-warning">
                <GuideIcon name="paw" />
                {PET_WARNING}
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}

/** Back to the plant, at every width: the Care Guide replaces its pane. */
function BackToPlant({ id, name }: { id: string; name: string }) {
  return (
    <a className="back-plant" href={`#/plant/${id}`}>
      ‹ {name}
    </a>
  );
}
