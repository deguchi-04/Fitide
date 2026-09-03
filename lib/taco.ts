import type { Nutrients } from './fit-types';

export interface TacoFood extends Nutrients {
  id: string;
  name: string;
}

// Valores por 100 g de parte comestível. Fonte: TACO, 4.ª ed., NEPA/UNICAMP (2011).
export const TACO_URL = 'https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf';

export const tacoFoods: TacoFood[] = [
  { id: '1', name: 'Arroz integral, cozido', calories: 124, protein: 2.6, carbs: 25.8, fat: 1, fiber: 2.7, calcium: 5, iron: 0.3, vitaminC: 0 },
  { id: '3', name: 'Arroz tipo 1, cozido', calories: 128, protein: 2.5, carbs: 28.1, fat: 0.2, fiber: 1.6, calcium: 4, iron: 0.1, vitaminC: 0 },
  { id: '7', name: 'Aveia em flocos, crua', calories: 394, protein: 13.9, carbs: 66.6, fat: 8.5, fiber: 9.1, calcium: 48, iron: 4.4, vitaminC: 0 },
  { id: '182', name: 'Banana prata, crua', calories: 98, protein: 1.3, carbs: 26, fat: 0.1, fiber: 2, calcium: 8, iron: 0.4, vitaminC: 21.6 },
  { id: '204', name: 'Maçã Fuji, com casca, crua', calories: 56, protein: 0.3, carbs: 15.2, fat: 0, fiber: 1.3, calcium: 2, iron: 0.1, vitaminC: 2.4 },
  { id: '230', name: 'Batata-doce, cozida', calories: 77, protein: 0.6, carbs: 18.4, fat: 0.1, fiber: 2.2, calcium: 17, iron: 0.2, vitaminC: 23.8 },
  { id: '258', name: 'Brócolis, cozido', calories: 25, protein: 2.1, carbs: 4.4, fat: 0.5, fiber: 3.4, calcium: 51, iron: 0.5, vitaminC: 42 },
  { id: '410', name: 'Frango, peito sem pele, grelhado', calories: 159, protein: 32, carbs: 0, fat: 2.5, fiber: 0, calcium: 5, iron: 0.3, vitaminC: 0 },
  { id: '561', name: 'Feijão carioca, cozido', calories: 76, protein: 4.8, carbs: 13.6, fat: 0.5, fiber: 8.5, calcium: 27, iron: 1.3, vitaminC: 0 },
  { id: '567', name: 'Feijão preto, cozido', calories: 77, protein: 4.5, carbs: 14, fat: 0.5, fiber: 8.4, calcium: 29, iron: 1.5, vitaminC: 0 },
  { id: '364', name: 'Ovo de galinha inteiro, cozido', calories: 146, protein: 13.3, carbs: 0.6, fat: 9.5, fiber: 0, calcium: 49, iron: 1.5, vitaminC: 0 },
  { id: '590', name: 'Coco, cru', calories: 406, protein: 3.7, carbs: 10.4, fat: 42, fiber: 5.4, calcium: 6, iron: 1.8, vitaminC: 2.5 },
  { id: '581', name: 'Soja, farinha', calories: 404, protein: 36, carbs: 38.4, fat: 14.6, fiber: 20.2, calcium: 206, iron: 13.1, vitaminC: 0 },
  { id: '594', name: 'Linhaça, semente', calories: 495, protein: 14.1, carbs: 43.3, fat: 32.3, fiber: 33.5, calcium: 211, iron: 4.7, vitaminC: 0 },
  { id: 'custom-oil', name: 'Azeite de oliva extravirgem', calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, calcium: 0, iron: 0, vitaminC: 0 },
];
