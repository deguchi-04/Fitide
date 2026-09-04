import type { Nutrients } from './fit-types';
import { portfirFoods } from './portfir';
import { tacoFoods } from './taco';

export interface FoodCatalogItem extends Nutrients {
  id: string;
  name: string;
}

function foodKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// A interface expõe um catálogo único. Registos com a mesma descrição
// normalizada são mantidos apenas uma vez, com preferência pela tabela mais atual.
const merged = [
  ...portfirFoods.map((food) => ({ ...food, id: `pt-${food.id}` })),
  ...tacoFoods,
];
const seen = new Set<string>();

export const foodCatalog: FoodCatalogItem[] = merged.filter((food) => {
  const key = foodKey(food.name);
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
});
