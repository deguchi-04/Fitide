import type { IngredientEntry } from './fit-types';

export function updateIngredientWeight(ingredient: IngredientEntry, grams: number): IngredientEntry {
  if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(ingredient.grams) || ingredient.grams <= 0) return ingredient;
  const factor = grams / ingredient.grams;
  // Keep recorded label values; round only for display, not between edits.
  return {
    ...ingredient,
    grams,
    calories: ingredient.calories * factor,
    protein: ingredient.protein * factor,
    carbs: ingredient.carbs * factor,
    fat: ingredient.fat * factor,
    fiber: ingredient.fiber * factor,
    calcium: ingredient.calcium * factor,
    iron: ingredient.iron * factor,
    vitaminC: ingredient.vitaminC * factor,
  };
}
