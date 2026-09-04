export type ParsedQuantityUnit = 'g' | 'unit' | 'ml';

export interface ParsedMealPart {
  original: string;
  query: string;
  amount: number;
  unit: ParsedQuantityUnit;
}

const numberWords: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  meia: 0.5,
  meio: 0.5,
};

function normalizeUnit(rawUnit?: string) {
  const unit = rawUnit?.toLowerCase().replace('.', '') ?? '';
  if (/^(kg|quilo|quilos|quilograma|quilogramas)$/.test(unit)) {
    return { unit: 'g' as const, factor: 1000 };
  }
  if (/^(g|gr|grs|grama|gramas)$/.test(unit)) {
    return { unit: 'g' as const, factor: 1 };
  }
  if (/^(l|litro|litros)$/.test(unit)) {
    return { unit: 'ml' as const, factor: 1000 };
  }
  if (/^(ml|mililitro|mililitros)$/.test(unit)) {
    return { unit: 'ml' as const, factor: 1 };
  }
  return { unit: 'unit' as const, factor: 1 };
}

function cleanFoodQuery(value: string) {
  return value
    .replace(/^d[eoas]+\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim();
}

export function parseMealDescription(value: string): ParsedMealPart[] {
  const parts = value
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+\+\s+/g, ',')
    .split(/\s*(?:,|;|\n)\s*|\s+e\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.flatMap((original) => {
    const numeric = original.match(
      /^(\d+(?:[.,]\d+)?)\s*(quilogramas?|quilos?|kg|gramas?|grs?|g|mililitros?|ml|litros?|l|unidades?|unid\.?|uds?\.?|x)?\s*(?:de\s+)?(.+)$/i,
    );
    if (numeric) {
      const normalized = normalizeUnit(numeric[2]);
      const query = cleanFoodQuery(numeric[3]);
      if (!query) return [];
      return [{
        original,
        query,
        amount: Number(numeric[1].replace(',', '.')) * normalized.factor,
        unit: normalized.unit,
      }];
    }

    const wordQuantity = original.match(
      /^(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|meia|meio)\s+(quilogramas?|quilos?|kg|gramas?|grs?|g|mililitros?|ml|litros?|l|unidades?|unid\.?|uds?\.?)?\s*(?:de\s+)?(.+)$/i,
    );
    if (wordQuantity) {
      const word = wordQuantity[1]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const normalized = normalizeUnit(wordQuantity[2]);
      const query = cleanFoodQuery(wordQuantity[3]);
      if (!query) return [];
      return [{
        original,
        query,
        amount: numberWords[word] * normalized.factor,
        unit: normalized.unit,
      }];
    }

    const query = cleanFoodQuery(original);
    return query ? [{ original, query, amount: 1, unit: 'unit' }] : [];
  });
}
