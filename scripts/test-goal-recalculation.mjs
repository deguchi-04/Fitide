import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../lib/calculations.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { suggestedGoals, weeksToGoal, tdee } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const profile = { currentWeightKg: 90, targetWeightKg: 80, heightCm: 180, age: 30, sex: 'male' };
const recalculate = (p, deficit) => {
  const goals = suggestedGoals(p, [], 'lose_fat', deficit);
  return { goals, weeks: weeksToGoal(p, goals.calorieTarget, tdee(p, [])) };
};
const initial = recalculate(profile, 300);
assert.equal(initial.goals.calorieDeficit, 300);
assert.equal(initial.goals.calorieTarget, tdee(profile, []) - 300);
assert.ok(recalculate(profile, 600).weeks < initial.weeks);
assert.ok(recalculate({ ...profile, currentWeightKg: 85 }, 300).weeks < initial.weeks);
assert.deepEqual(recalculate(profile, 300), initial);
assert.equal(recalculate(profile, 0).weeks, null);
assert.equal(recalculate({ ...profile, currentWeightKg: 80 }, 300).weeks, 0);
assert.equal(weeksToGoal(profile, tdee(profile, []) + 250, tdee(profile, [])), null);
assert.equal(weeksToGoal({ ...profile, targetWeightKg: 95 }, tdee(profile, []) - 300, tdee(profile, [])), null);
console.log('Goal recalculation: chosen deficit, current weight, unchanged inputs, maintenance, reached goal and wrong-direction balances passed.');
