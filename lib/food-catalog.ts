import type { Nutrients } from './fit-types';
import { portfirFoods } from './portfir';
import { tacoFoods } from './taco';
import { japaneseFoods } from './japan-foods';

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
  {
    id: 'usda-173242',
    name: 'Wrap ou tortilha de trigo, pronta',
    calories: 325,
    protein: 8.7,
    carbs: 55.6,
    fat: 7.1,
    fiber: 3.3,
    calcium: 39,
    iron: 3.3,
    vitaminC: 0,
  },
  {
    id: 'usda-173180',
    name: 'Whey protein em pó, à base de soro de leite',
    calories: 352,
    protein: 78.13,
    carbs: 6.25,
    fat: 1.56,
    fiber: 3.1,
    calcium: 469,
    iron: 1.13,
    vitaminC: 0,
  },
  ...portfirFoods.map((food) => ({ ...food, id: `pt-${food.id}` })),
  ...tacoFoods,
  ...japaneseFoods.map((food) => food.id === 'jp-10151'
    ? { ...food, name: 'Salmão fumado (sockeye)' }
    : food),
];
const seen = new Set<string>();

export const foodCatalog: FoodCatalogItem[] = merged.filter((food) => {
  const key = foodKey(food.name);
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
});
