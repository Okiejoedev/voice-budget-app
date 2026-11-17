import { describe, expect, it } from 'vitest';
import { parseLocal } from './parser';
import { DEFAULT_POTS } from './dictionary';
import { findAmounts, normaliseForTest } from './testUtils';

const TODAY = new Date(2026, 10, 17); // 17 Nov 2026 (Tuesday)
const p = (s: string) => parseLocal(s, DEFAULT_POTS, TODAY);

describe('amounts', () => {
  const cases: [string, number][] = [
    ['2k', 2000], ['1.5k', 1500], ['200k', 200000], ['₦2,500', 2500], ['N2500', 2500], ['2500 naira', 2500],
    ['fifty thousand', 50000], ['two thousand five hundred', 2500], ['twenty five hundred', 2500],
    ['one point five k', 1500], ['fifty k', 50000], ['1m', 1000000], ['half a million', 500000], ['1k5', 1500],
    ['a thousand', 1000], ['two hundred thousand', 200000], ['1,250,000', 1250000],
  ];
  for (const [text, want] of cases) {
    it(text, () => {
      const got = findAmounts(normaliseForTest(text));
      expect(got[0]?.value).toBe(want);
    });
  }
});

describe('expenses', () => {
  it('chop for mama put', () => {
    const r = p('I chop 1500 for mama put');
    expect(r.intent).toBe('expense');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ amount: 1500, potId: 'feeding' });
    expect(r.items[0].note.toLowerCase()).toContain('mama put');
  });
  it('enter keke', () => {
    const r = p('I enter keke 800');
    expect(r.intent).toBe('expense');
    expect(r.items[0]).toMatchObject({ amount: 800, potId: 'transport' });
  });
  it('buy data in english', () => {
    const r = p('I bought data for 2k');
    expect(r.items[0]).toMatchObject({ amount: 2000, potId: 'data' });
  });
  it('several items in one breath', () => {
    const r = p('I enter keke 800, buy data 2k and chop 1,500');
    expect(r.intent).toBe('expense');
    expect(r.items.map((i) => [i.amount, i.potId])).toEqual([
      [800, 'transport'], [2000, 'data'], [1500, 'feeding'],
    ]);
  });
  it('several items without commas', () => {
    const r = p('keke 800 data 2k');
    expect(r.items.map((i) => [i.amount, i.potId])).toEqual([[800, 'transport'], [2000, 'data']]);
  });
  it('amount before the pot words', () => {
    const r = p('800 for keke 2k for data');
    expect(r.items.map((i) => [i.amount, i.potId])).toEqual([[800, 'transport'], [2000, 'data']]);
  });
  it('notes stay clean in a run-on sentence', () => {
    const r = p('keke 800 data 2k');
    expect(r.items[0].note.toLowerCase()).toBe('keke');
  });
  it('quantity is not the price', () => {
    const r = p('I buy 2 bread for 1200');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ amount: 1200, potId: 'feeding' });
  });
  it('rice and beans stays one item', () => {
    const r = p('I chop rice and beans 1500');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ amount: 1500, potId: 'feeding' });
  });
  it('yesterday', () => {
    const r = p('yesterday I spend 3k on bolt');
    expect(r.items[0]).toMatchObject({ amount: 3000, potId: 'transport', date: '2026-11-16' });
  });
  it('light bill', () => {
    expect(p('I pay light bill 10k').items[0].potId).toBe('power');
  });
  it('offering', () => {
    expect(p('offering 2k').items[0].potId).toBe('giving');
  });
  it('send mama money', () => {
    expect(p('I send mama 20k').items[0]).toMatchObject({ amount: 20000, potId: 'family' });
  });
  it('unknown category goes to other with a warning', () => {
    const r = p('I spend 5k on something');
    expect(r.items[0].potId).toBe('other');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('fuel without for stays expense', () => {
    const r = p('I put fuel 5k');
    expect(r.intent).toBe('expense');
    expect(r.items[0].potId).toBe('transport');
  });
});

describe('income', () => {
  it('salary don land', () => {
    const r = p('Salary don land, 200k');
    expect(r.intent).toBe('income');
    expect(r.items[0]).toMatchObject({ amount: 200000, note: 'Salary' });
  });
  it('bare 200 for salary means 200k', () => {
    const r = p('salary don land 200');
    expect(r.items[0].amount).toBe(200000);
    expect(r.warnings.length).toBe(1);
  });
  it('i collect', () => {
    const r = p('I collect 70k today from client');
    expect(r.intent).toBe('income');
    expect(r.items[0].amount).toBe(70000);
  });
  it('english', () => {
    expect(p('I made 60,000 today').intent).toBe('income');
  });
});

describe('plan', () => {
  it('splits salary into pots', () => {
    const r = p('Abeg put 20k for data, 60k for transport and 60k for feeding');
    expect(r.intent).toBe('plan');
    expect(r.items.map((i) => [i.amount, i.potId])).toEqual([
      [20000, 'data'], [60000, 'transport'], [60000, 'feeding'],
    ]);
  });
  it('english budget', () => {
    const r = p('Budget 20,000 for data and 60,000 for transport');
    expect(r.intent).toBe('plan');
    expect(r.items).toHaveLength(2);
  });
  it('i want x for y', () => {
    const r = p('I want 20k for data');
    expect(r.intent).toBe('plan');
  });
});

describe('savings vault', () => {
  it('save', () => {
    const r = p('put 50k for savings');
    expect(r.intent).toBe('vault_in');
    expect(r.items[0].amount).toBe(50000);
  });
  it('withdraw', () => {
    const r = p('I comot 20k from my savings');
    expect(r.intent).toBe('vault_out');
    expect(r.items[0].amount).toBe(20000);
    expect(r.items[0].note).toBe(''); // the user must give a reason
  });
});

describe('questions, undo, edit', () => {
  it('wetin remain for feeding', () => {
    const r = p('Wetin remain for my feeding?');
    expect(r.intent).toBe('question');
    expect(r.question).toMatchObject({ potId: 'feeding', kind: 'remaining' });
  });
  it('how much i spend on transport this week', () => {
    const r = p('How much I don spend on transport this week');
    expect(r.question).toMatchObject({ potId: 'transport', kind: 'spent', range: 'week' });
  });
  it('summary', () => {
    expect(p('how far my money').question?.kind).toBe('summary');
  });
  it('undo', () => {
    expect(p('cancel am').intent).toBe('undo');
    expect(p('no be dat one').intent).toBe('undo');
  });
  it('edit last', () => {
    const r = p('change am to 3k');
    expect(r.intent).toBe('edit_last');
    expect(r.items[0].amount).toBe(3000);
  });
  it('nonsense is unknown', () => {
    expect(p('good morning').intent).toBe('unknown');
  });
});
