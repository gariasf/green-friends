import { dueLine } from './words';

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
