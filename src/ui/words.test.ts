import {
  causeFactLine,
  dueLine,
  lightLabel,
  lightWords,
  npkNote,
  scheduleLine,
  seasonLine,
} from './words';

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
      'every 7 days, every 14 days in the Dormant season',
    );
    expect(scheduleLine({ growing: 30, dormant: null })).toBe(
      'every 30 days, paused in the Dormant season',
    );
    expect(scheduleLine({ growing: null, dormant: null })).toBe('no schedule');
  });

  it('says the Season, and until when it is Dormant', () => {
    expect(seasonLine({ season: 'growing', startsOn: '2026-03-01' }, '2026-09-22')).toBe(
      'Growing season',
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
      'Last watered 6 days ago. Schedule: every 7 days, every 14 days in the Dormant season',
    );
    expect(causeFactLine({ kind: 'watering', lastOn: '2026-09-21', schedule }, '2026-09-22')).toBe(
      'Last watered yesterday. Schedule: every 7 days, every 14 days in the Dormant season',
    );
    expect(
      causeFactLine(
        { kind: 'fertilizing', lastOn: null, schedule: { growing: null, dormant: null } },
        '2026-09-22',
      ),
    ).toBe('Last fed: never logged. No schedule');
    expect(
      causeFactLine({ kind: 'repotting', lastOn: '2025-09-22', potSizeCm: 17 }, '2026-09-22'),
    ).toBe('Last repotted 12 months ago, in a 17 cm pot');
    expect(causeFactLine({ kind: 'repotting', lastOn: null, potSizeCm: null }, '2026-09-22')).toBe(
      'Last repotted: never logged',
    );
    expect(
      causeFactLine(
        { kind: 'season', season: { season: 'growing', startsOn: null } },
        '2026-09-22',
      ),
    ).toBe('Growing season');
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
});
