import type { Activity, Goals, Nutrients, Profile } from './fit-types';

export const emptyNutrients = (): Nutrients => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  calcium: 0,
  iron: 0,
  vitaminC: 0,
});

export function bmr(profile: Profile) {
  const sexOffset = profile.sex === 'male' ? 5 : -161;
  return Math.round(10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * profile.age + sexOffset);
}

export function exerciseCaloriesPerWeek(profile: Profile, activities: Activity[]) {
  return activities.reduce(
    (sum, activity) => sum + activity.met * profile.currentWeightKg * (activity.minutes / 60) * activity.days.length,
    0,
  );
}

export function tdee(profile: Profile, activities: Activity[]) {
  return Math.round(bmr(profile) * 1.2 + exerciseCaloriesPerWeek(profile, activities) / 7);
}

export function suggestedGoals(profile: Profile, activities: Activity[], kind: Goals['kind']): Goals {
  const maintenance = tdee(profile, activities);
  const calorieTarget = Math.max(1200, Math.round(maintenance + (kind === 'lose_fat' ? -450 : kind === 'gain_muscle' ? 250 : 0)));
  const proteinG = Math.round(profile.currentWeightKg * (kind === 'gain_muscle' ? 2 : 1.8));
  const fatG = Math.round(profile.currentWeightKg * 0.8);
  const carbsG = Math.max(50, Math.round((calorieTarget - proteinG * 4 - fatG * 9) / 4));
  return {
    kind,
    calorieTarget,
    proteinG,
    carbsG,
    fatG,
    fiberG: Math.round((calorieTarget / 1000) * 14),
    waterLiters: Math.round(profile.currentWeightKg * 0.035 * 10) / 10,
    fastingHours: 16,
  };
}

export function weeksToGoal(profile: Profile, dailyCalories: number, maintenance: number) {
  const deltaKg = Math.abs(profile.currentWeightKg - profile.targetWeightKg);
  if (deltaKg < 0.1) return 0;
  const dailyDelta = Math.abs(maintenance - dailyCalories);
  if (dailyDelta < 100) return null;
  return Math.ceil((deltaKg * 7700) / (dailyDelta * 7));
}

export function sumNutrients(items: Nutrients[]) {
  return items.reduce((acc, item) => {
    (Object.keys(acc) as (keyof Nutrients)[]).forEach((key) => (acc[key] += item[key]));
    return acc;
  }, emptyNutrients());
}

export function roundNutrients(nutrients: Nutrients): Nutrients {
  return Object.fromEntries(Object.entries(nutrients).map(([key, value]) => [key, Math.round(value * 10) / 10])) as unknown as Nutrients;
}
