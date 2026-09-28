import {
  causeFactLine,
  dueLine,
  feedLine,
  lightLabel,
  lightWords,
  nextCareLine,
  nextCareWhen,
  npkNote,
  plural,
  scheduleLine,
  seasonLine,
  tileLine,
  tileValue,
} from './words';

describe('Plant screen tiles', () => {
  const today = '2026-09-28';
  it('say which way they count, the unit apart from the number', () => {
    expect(tileValue({ state: 'upcoming', dueOn: '2026-09-29' }, today)).toEqual([
      { before: 'in', value: '1', after: 'd' },
      'due in 1\u00a0day',
    ]);
    expect(tileValue({ state: 'upcoming', dueOn: '2028-03-07' }, today)[0]).toEqual({
      before: 'in',
      value: '17',
      after: 'mo',
    });
    expect(tileValue({ state: 'due', dueOn: '2026-09-23', daysOverdue: 5 }, today)).toEqual([
      { value: '5', after: 'd overdue' },
      '5\u00a0days overdue',
    ]);
    expect(tileValue({ state: 'due', dueOn: today, daysOverdue: 0 }, today)[0]).toEqual({
      value: 'Today',
    });
  });

  it('say the next day while upcoming, the last one once Due', () => {
    expect(tileLine({ state: 'upcoming', dueOn: '2026-09-29' }, '2026-09-22', today)).toMatch(
      /^Tue, Sep 29$/,
    );
    expect(tileLine({ state: 'upcoming', dueOn: '2028-03-07' }, undefined, today)).toBe(
      'Mar 7, 2028',
    );
    expect(
      tileLine({ state: 'due', dueOn: '2026-09-23', daysOverdue: 5 }, '2026-08-24', today),
    ).toBe('Last Aug 24');
  });
});

describe('dueLine', () => {
  it('says what is Overdue, then what is Due today', () => {
    expect(dueLine([{ type: 'fertilize', dueOn: '2026-09-20', daysOverdue: 6 }])).toBe(
      'Fertilize overdue',
    );
    expect(dueLine([{ type: 'water', dueOn: '2026-09-26', daysOverdue: 0 }])).toBe(
      'Water due today',
    );
    expect(
      dueLine([
        { type: 'water', dueOn: '2026-09-26', daysOverdue: 0 },
        { type: 'fertilize', dueOn: '2026-09-20', daysOverdue: 6 },
        { type: 'repot', dueOn: '2026-09-25', daysOverdue: 1 },
      ]),
    ).toBe('Fertilize, Repot overdue · Water due today');
  });
});

describe('Care Guide lines', () => {
  it('says a seasonal schedule in one line', () => {
    expect(scheduleLine({ growing: 7, dormant: 14 })).toBe(
      'every 7\u00a0days, every 14\u00a0days in the Dormant season',
    );
    expect(scheduleLine({ growing: 30, dormant: null })).toBe(
      'every 30\u00a0days, paused in the Dormant season',
    );
    expect(scheduleLine({ growing: null, dormant: null })).toBe('no schedule');
    // A garden Growing all year has no Dormant season to mention.
    expect(scheduleLine({ growing: 7, dormant: 14 }, true)).toBe('every 7\u00a0days');
  });

  it('says the Season, and until when it is Dormant', () => {
    expect(seasonLine({ season: 'growing', startsOn: '2026-03-01' }, '2026-09-22')).toBe(
      'Growing season',
    );
    expect(seasonLine({ season: 'growing', startsOn: null }, '2026-09-22')).toBe(
      'Growing all year',
    );
    expect(
      seasonLine(
        { season: 'dormant', startsOn: '2026-11-01', resumesOn: '2027-03-01' },
        '2026-11-20',
      ),
    ).toMatch(/^Dormant season, until Mar 1(, 2027)?$/);
  });

  it('says what the Care Log says beside a cause', () => {
    const schedule = { growing: 7, dormant: 14 };
    expect(causeFactLine({ kind: 'watering', lastOn: '2026-09-16', schedule }, '2026-09-22')).toBe(
      'Last watered 6\u00a0days ago. Schedule: every 7\u00a0days, every 14\u00a0days in the Dormant season',
    );
    expect(causeFactLine({ kind: 'watering', lastOn: '2026-09-21', schedule }, '2026-09-22')).toBe(
      'Last watered yesterday. Schedule: every 7\u00a0days, every 14\u00a0days in the Dormant season',
    );
    expect(
      causeFactLine(
        { kind: 'fertilizing', lastOn: null, schedule: { growing: null, dormant: null } },
        '2026-09-22',
      ),
    ).toBe('Last fertilized: never logged. No schedule');
    expect(
      causeFactLine({ kind: 'repotting', lastOn: '2025-09-22', potSizeCm: 17 }, '2026-09-22'),
    ).toBe('Last repotted 12\u00a0months ago, in a 17 cm pot');
    expect(causeFactLine({ kind: 'repotting', lastOn: null, potSizeCm: null }, '2026-09-22')).toBe(
      'Last repotted: never logged',
    );
    expect(
      causeFactLine(
        { kind: 'season', season: { season: 'growing', startsOn: null } },
        '2026-09-22',
      ),
    ).toBe('Growing all year');
  });

  it('says how bright, then how much direct sun', () => {
    expect(lightWords({ level: 'bright-indirect', directSun: 'morning' })).toEqual([
      'Bright indirect light',
      'Morning sun',
    ]);
    expect(lightWords({ level: 'medium', directSun: 'none' })).toEqual([
      'Medium light',
      'No direct sun',
    ]);
    expect(lightWords({ level: 'bright-indirect', directSun: 'some' })).toEqual([
      'Bright indirect light',
      'A few hours of sun',
    ]);
  });

  it('says direct sun once, with its hours', () => {
    expect(lightWords({ level: 'direct', directSun: 'all-day' })).toEqual([
      'Full sun',
      '6 hours or more a day',
    ]);
    expect(lightWords({ level: 'direct', directSun: 'some' })).toEqual([
      'Part sun',
      '3 to 6 hours a day',
    ]);
  });

  it('says the light in one line for VoiceOver', () => {
    expect(lightLabel({ level: 'bright-indirect', directSun: 'morning' })).toBe(
      'Light: bright indirect light, morning sun',
    );
    expect(lightLabel({ level: 'direct', directSun: 'all-day' })).toBe(
      'Light: full sun, 6 hours or more a day',
    );
  });

  it('explains N-P-K beneath a fertiliser that names it', () => {
    expect(npkNote('Balanced liquid fertiliser (N-P-K roughly 1-1-1)')).toMatch(/nitrogen/);
    expect(npkNote('No fertiliser')).toBeNull();
  });

  it('leaves the ratio to the Fertiliser card, which explains it', () => {
    const profile = {
      fertilizer: {
        type: 'Balanced liquid fertiliser (N-P-K roughly 3-1-2)',
        dormant: 'Stop feeding.',
      },
    } as Parameters<typeof feedLine>[0];
    expect(feedLine(profile, 'growing')).toBe('Balanced liquid fertiliser');
    expect(feedLine(profile, 'dormant')).toBe('Stop feeding.');
  });
});

describe('next care', () => {
  // A no-break space: a line may wrap before the count, never between it and its unit.
  const NBSP = '\u00a0';

  test('a count keeps its unit on its line', () => {
    expect(plural(12, 'day')).toBe(`12${NBSP}days`);
    expect(plural(1, 'plant')).toBe(`1${NBSP}plant`);
  });

  test('when, for a strip that shows the care type as its icon', () => {
    expect(nextCareWhen({ type: 'water', days: 12, paused: false })).toBe(`in 12${NBSP}days`);
    expect(nextCareWhen({ type: 'fertilize', days: 1, paused: false })).toBe('tomorrow');
    expect(nextCareWhen({ type: 'repot', days: 90, paused: false })).toBe(`in 3${NBSP}months`);
  });

  test('the whole line names the care type before when', () => {
    expect(nextCareLine({ type: 'water', days: 12, paused: false })).toBe(`Water in 12${NBSP}days`);
    expect(nextCareLine({ type: 'fertilize', days: 1, paused: false })).toBe('Fertilize tomorrow');
    expect(nextCareLine({ type: 'water', days: 40, paused: true })).toBe('Resting');
    expect(nextCareLine(null)).toBe('No schedule');
  });
});
