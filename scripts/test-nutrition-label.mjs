import assert from 'node:assert/strict';
import { readNutritionLabel } from '../lib/nutrition-label.ts';

const samples = [
  ['Declaração nutricional por 100g de produto: energia: 1001 kJ / 242 kcal; lípidos: 20,5 g; dos quais saturados: 2,5 g; hidratos de carbono: 12,1 g; dos quais açúcares: 7,6 g; fibra: 1,3 g; proteínas: 1,6 g; sal: 1,2 g', {calories:242,fat:20.5,carbs:12.1,fiber:1.3,protein:1.6}],
  ['Por 100g Por 20g\nValor energético 1137 kJ / 267 kcal 227 kJ / 53 kcal\nLípidos 1,4 g 0,3 g\ndos quais saturados 0,3 g <0,1 g\nH.Carbono 63 g 13 g\ndos quais açúcares 59 g 12 g\nFibra 1,1 g 0,2 g\nProteínas 0,7 g 0,1 g', {calories:267,fat:1.4,carbs:63,fiber:1.1,protein:.7}],
  ['Por 100 g\nEnergia 1374 kJ 333 kcal\nLípidos 32,8 g\nDos quais saturados 3,7 g\nHidratos de carbono 8,5 g\nProteínas 0,7 g', {calories:333,fat:32.8,carbs:8.5,protein:.7}],
  ['Average nutritional values per 100 g\nEnergy / Valor energético / Energia / Energie 518 kJ / 125 kcal\nFat / Grasas / Lípidos / Matières grasses 8,2 g\nCarbohydrate / Hidratos de carbono / Glucides 7,7 g\nFibre / Fibra alimentar / Fibra / Fibres alimentaires 6,0 g\nProtein / Proteínas / Protéines 2,2 g', {calories:125,fat:8.2,carbs:7.7,fiber:6,protein:2.2}],
];
for (const [text, expected] of samples) assert.deepEqual(readNutritionLabel(text).values, expected);
assert.throws(() => readNutritionLabel('Por porção 20 g Proteínas 5 g'), /missing-per-100/);
assert.throws(() => readNutritionLabel('Por 1000 g Proteínas 5 g'), /missing-per-100/);
assert.equal(readNutritionLabel('Por 100ml Energia 322 kcal Lípidos <0,5 g Hidratos de carbono 78 g Proteínas 1,7 g').basis, 'ml');
assert.equal(readNutritionLabel(samples[2][0]).values.fiber, undefined);
assert.equal(readNutritionLabel('Por 100g FIBRA ALIMENTAR1, 3g Proteínas 5g').values.fiber, 1.3);
assert.equal(readNutritionLabel('Por 100g F1BRAS ALIMENTARES\n3,4\nProteínas 5g').values.fiber, 3.4);
assert.equal(readNutritionLabel('Por 100g Fibras 0g Proteínas 5g').values.fiber, 0);
console.log('Nutrition parser: 11 regression checks passed.');
