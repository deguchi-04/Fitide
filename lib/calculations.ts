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

export function activityIntensity(activity: Activity) {
  if (Number.isFinite(activity.intensity)) return Math.min(5, Math.max(1, Math.round(activity.intensity)));

  // Migração transparente das atividades guardadas antes da escala 1–5.
  const name = activity.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (name.includes('judo')) return 3;
  if (name.includes('musculacao')) return 2;
  if (name.includes('caminhada')) return 1;
  if (name.includes('futebol competitivo')) return 4;
  if (name.includes('futebol') || name.includes('corrida') || name.includes('natacao')) return 3;
  if (name.includes('bicicleta')) return 2;

  const legacyMet = Number(activity.met);
  if (!Number.isFinite(legacyMet)) return 2;
  if (legacyMet <= 3) return 1;
  if (legacyMet <= 6) return 2;
  if (legacyMet <= 9) return 3;
  if (legacyMet <= 12) return 4;
  return 5;
}

function activityExtraCalories(profile: Profile, activity: Activity) {
  const intensity = activityIntensity(activity);
  // Equivalentes MET adicionais (o repouso já está incluído na base sedentária).
  // A escala deliberadamente conservadora evita contar duas vezes o gasto basal.
  const extraMet = [0, 1.5, 2.75, 4, 6, 8][intensity];
  const minutes = Math.min(1440, Math.max(0, activity.minutes));
  return extraMet * 3.5 * profile.currentWeightKg / 200 * minutes;
}

export function exerciseCaloriesPerWeek(profile: Profile, activities: Activity[]) {
  return activities.reduce(
    (sum, activity) => {
      if (activity.specificDate) return sum;
      const validDays = new Set(activity.days.filter((day) => day >= 0 && day <= 6)).size;
      return sum + activityExtraCalories(profile, activity) * validDays;
    },
    0,
  );
}

export function exerciseCaloriesForDay(profile: Profile, activities: Activity[], day: number, date?: string) {
  return activities
    .filter((activity) => activity.specificDate ? activity.specificDate === date : activity.days.includes(day))
    .reduce((sum, activity) => sum + activityExtraCalories(profile, activity), 0);
}

export function sedentaryTdee(profile: Profile) {
  return Math.round(bmr(profile) * 1.2);
}

export function tdee(profile: Profile, activities: Activity[]) {
  return Math.round(sedentaryTdee(profile) + exerciseCaloriesPerWeek(profile, activities) / 7);
}

export function tdeeForDay(profile: Profile, activities: Activity[], day: number) {
  return Math.round(sedentaryTdee(profile) + exerciseCaloriesForDay(profile, activities, day));
}

export function calorieDeficit(maintenance: number, calorieTarget: number) {
  return Math.max(0, Math.round(maintenance - calorieTarget));
}

export function recommendedDeficit(maintenance: number) {
  // A moderate starting point that scales with expenditure, bounded to avoid
  // an implausibly tiny or aggressive automatic suggestion.
  return Math.min(750, Math.max(250, Math.round((maintenance * 0.18) / 25) * 25));
}

export function fatEquivalentKg(dailyDeficit: number, days = 7) {
  return Math.round(((dailyDeficit * days) / 7700) * 1000) / 1000;
}

export function suggestedMacroGoals(profile: Profile, kind: Goals['kind'], calorieTarget: number) {
  const proteinG = Math.round(profile.currentWeightKg * (kind === 'gain_muscle' ? 2 : 1.8));
  const fatG = Math.round(profile.currentWeightKg * 0.8);
  const carbsG = Math.max(50, Math.round((calorieTarget - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, fatG, carbsG, fiberG: Math.round((calorieTarget / 1000) * 14) };
}

export function suggestedGoals(profile: Profile, activities: Activity[], kind: Goals['kind'], preferredDeficit?: number): Goals {
  const maintenance = tdee(profile, activities);
  const calorieDeficit = kind === 'lose_fat'
    ? (preferredDeficit !== undefined && Number.isFinite(preferredDeficit)
      ? Math.min(1000, Math.max(0, preferredDeficit)) : recommendedDeficit(maintenance))
    : 0;
  const calorieTarget = Math.max(1000, Math.round(maintenance - calorieDeficit + (kind === 'gain_muscle' ? 250 : 0)));
  return {
    kind,
    calorieDeficit,
    calorieTarget,
    ...suggestedMacroGoals(profile, kind, calorieTarget),
    waterLiters: Math.round(profile.currentWeightKg * 0.035 * 10) / 10,
    fastingHours: 16,
  };
}

export function weeksToGoal(profile: Profile, dailyCalories: number, maintenance: number) {
  const deltaKg = Math.abs(profile.currentWeightKg - profile.targetWeightKg);
  if (deltaKg < 0.1) return 0;
  const dailyDelta = profile.targetWeightKg < profile.currentWeightKg
    ? maintenance - dailyCalories : dailyCalories - maintenance;
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
