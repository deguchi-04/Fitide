import type { IngredientEntry, Meal, WorkoutExercise, WorkoutSession } from './fit-types';
export const ingredientKey = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
export const exerciseKey = (exercise: Pick<WorkoutExercise, 'name' | 'equipment'>) => `${ingredientKey(exercise.name)}::${ingredientKey(exercise.equipment)}`;
export function frequentIngredients(meals: Meal[]) {
  const counts = new Map<string, { ingredient: IngredientEntry; count: number }>();
  for (const meal of [...meals].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) for (const item of meal.ingredients) {
    const key = ingredientKey(item.name);
    counts.set(key, { ingredient: item, count: (counts.get(key)?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.ingredient.name.localeCompare(b.ingredient.name, 'pt'));
}
export function shoppingList(meals: Meal[]) {
  const totals = new Map<string, { key: string; name: string; grams: number }>();
  for (const meal of meals) for (const item of meal.ingredients) {
    const key = ingredientKey(item.name);
    totals.set(key, { key, name: item.name, grams: (totals.get(key)?.grams ?? 0) + item.grams });
  }
  return [...totals.values()].map(item => ({ ...item, grams: Math.round(item.grams * 10) / 10 })).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}
export function latestExerciseSets(exercise: WorkoutExercise, sessions: WorkoutSession[], beforeDate = '9999-12-31', planId?: string) {
  const key = exerciseKey(exercise);
  const recent = [...sessions].filter(item => item.date <= beforeDate).reverse().sort((a, b) => b.date.localeCompare(a.date));
  const candidates = planId ? [...recent.filter(item => item.planId === planId), ...recent.filter(item => item.planId !== planId)] : recent;
  for (const session of candidates) {
    const sets = session.exercises?.filter(item => item.key === key).flatMap(item => item.sets).filter(set => Number.isFinite(set.load) && set.load >= 0 && Number.isFinite(set.reps) && set.reps > 0);
    if (sets?.length) return sets;
  }
  return [];
}
export function adaptExercise(exercise: WorkoutExercise, sessions: WorkoutSession[]) {
  const sets = latestExerciseSets(exercise, sessions);
  return sets.length ? { ...exercise, weightKg: sets[0].load, reps: String(sets[0].reps) } : exercise;
}
