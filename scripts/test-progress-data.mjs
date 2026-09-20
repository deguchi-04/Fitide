import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
async function load(path) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { nutritionDays, weekStart, shiftDate } = await load('../lib/progress-data.ts');
assert.equal(weekStart('2026-09-20'), '2026-09-14');
assert.equal(weekStart('2026-09-14'), '2026-09-14');
assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
const state = { meals: [{ date: '2026-09-15', ingredients: [{ protein: 20, carbs: 30, fat: 10 }] }, { date: '2026-09-16', ingredients: [{ protein: 25, carbs: 50, fat: 5 }] }], water: [{ date: '2026-09-15', liters: 1.5 }] };
for (const [range, days] of [['week', 7], ['month', 28], ['year', 364]]) {
  const data = nutritionDays(state, '2026-09-17', range);
  assert.equal(data.length, days);
  assert.equal(data.at(-1).date, '2026-09-20');
  assert.equal(data.find(day => day.date === '2026-09-15').protein, 20);
  assert.equal(data.find(day => day.date === '2026-09-16').protein, 25);
  assert.equal(data.find(day => day.date === '2026-09-15').water, 1.5);
  assert.equal(data.at(-1).protein, null);
}
const { latestExerciseSets, exerciseKey } = await load('../lib/personal-tracking.ts');
const exercise = { name: 'Supino', equipment: 'Barra' }, key = exerciseKey(exercise);
const sessions = [{ date: '2026-09-14', planId: 'segunda', exercises: [{ key, sets: [{ load: 40, reps: 12 }] }] }, { date: '2026-09-17', planId: 'quinta', exercises: [{ key, sets: [{ load: 60, reps: 6 }] }] }];
assert.deepEqual(latestExerciseSets(exercise, sessions, '2026-09-21', 'segunda'), [{ load: 40, reps: 12 }]);
assert.deepEqual(latestExerciseSets(exercise, sessions, '2026-09-21', 'nova'), [{ load: 60, reps: 6 }]);
console.log('Progress: daily values in 3 windows, dates, missing records and routine defaults passed.');
const { isFreshMealDraft, MEAL_DRAFT_TTL_MS } = await load('../lib/meal-draft.ts');
const now = Date.now();
assert.equal(isFreshMealDraft({updatedAt: now - 60_000}, now), true);
assert.equal(isFreshMealDraft({updatedAt: now - MEAL_DRAFT_TTL_MS}, now), false);
assert.equal(isFreshMealDraft({}, now), false);
assert.equal(isFreshMealDraft({updatedAt: now + 1}, now), false);
assert.equal(isFreshMealDraft(null, now), false);
console.log('Meal drafts: recent, expired, legacy, future and empty checks passed.');
