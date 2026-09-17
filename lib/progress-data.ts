import type { AppState } from './fit-types';

export type NutritionWindow = 'week' | 'month' | 'year';
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function weekStart(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return shiftDate(date, -((day + 6) % 7));
}
// Every point remains one day, including the wider 4- and 52-week views.
export function nutritionDays(state: Pick<AppState, 'meals' | 'water'>, endWeek: string, window: NutritionWindow) {
  const days = window === 'week' ? 7 : window === 'month' ? 28 : 364;
  const start = shiftDate(weekStart(endWeek), 7 - days);
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDate(start, i);
    const meals = state.meals.filter(meal => meal.date === date);
    const water = state.water.filter(item => item.date === date);
    const ingredients = meals.flatMap(meal => meal.ingredients);
    const sum = (key: 'protein' | 'carbs' | 'fat') => meals.length ? Math.round(ingredients.reduce((total, item) => total + item[key], 0) * 10) / 10 : null;
    return { date, protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat'), water: water.length ? water.reduce((total, item) => total + item.liters, 0) : null };
  });
}
