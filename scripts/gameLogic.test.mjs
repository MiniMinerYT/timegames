import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/gameLogic.ts', import.meta.url), 'utf8');
const executable = source
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  .replace(/ as const/g, '')
  .replace(/([,(]\s*[A-Za-z_$][\w$]*)\s*:\s*(?:number|string)/g, '$1')
  .replace(/\)\s*:\s*(?:number|string|boolean)\s*\{/g, ') {');

const loadGameLogic = new Function(`${executable}
return {
  rankThresholds,
  ranks,
  getRank,
  calculateRatingChange,
  getDailyReward,
  getDailyTarget,
  sanitizeTimeInput,
  isValidTimeInput,
};`);

const logic = loadGameLogic();

test('rank thresholds match the documented Clock Rating ladder', () => {
  assert.deepEqual(logic.rankThresholds, [0, 200, 450, 800, 1300, 2000, 3000]);
  assert.equal(logic.getRank(0).rank.name, 'Bronze Clock');
  assert.equal(logic.getRank(200).rank.name, 'Silver Clock');
  assert.equal(logic.getRank(450).rank.name, 'Gold Clock');
  assert.equal(logic.getRank(3000).rank.name, 'Chrono Master');
});

test('daily streak rewards cap at day ten', () => {
  assert.equal(logic.getDailyReward(1), 10);
  assert.equal(logic.getDailyReward(5), 40);
  assert.equal(logic.getDailyReward(9), 90);
  assert.equal(logic.getDailyReward(10), 100);
  assert.equal(logic.getDailyReward(30), 100);
});

test('daily targets are deterministic and within the allowed range', () => {
  const first = logic.getDailyTarget('2026-06-30');
  const second = logic.getDailyTarget('2026-06-30');
  assert.equal(first, second);
  assert.ok(first >= 0.5);
  assert.ok(first <= 10);
});

test('time input is keypad-safe and capped to two decimals', () => {
  assert.equal(logic.sanitizeTimeInput('1234'), '12.34');
  assert.equal(logic.sanitizeTimeInput('9.876'), '9.87');
  assert.equal(logic.sanitizeTimeInput('ab10,5c'), '10.5');
  assert.equal(logic.isValidTimeInput('10.25'), true);
  assert.equal(logic.isValidTimeInput('100.25'), false);
});

test('spot-on and near-spot-on ranked guesses are meaningfully rewarded', () => {
  assert.ok(logic.calculateRatingChange(0, 0) > logic.calculateRatingChange(0.2, 0));
  assert.ok(logic.calculateRatingChange(0.04, 1000) > logic.calculateRatingChange(0.4, 1000));
});
