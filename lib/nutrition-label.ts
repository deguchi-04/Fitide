// Interpret only an explicitly labelled 100 g/ml column, never serving values.
export function readNutritionLabel(text: string) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const reference = /\b100\s*(g|gr|gramas|ml)\b/.exec(normalized);
  if (!reference) throw new Error('missing-per-100');
  const before = normalized.slice(0, reference.index);
  // A serving column before the 100 g column needs explicit column selection.
  if (/(?:por\s+porcao|per\s+serving)\s*\(?\d+\s*g\)?\s*$/.test(before)) throw new Error('ambiguous-columns');
  const content = normalized.slice(reference.index + reference[0].length);
  const fields = /\b(valor energetico|energia|energy|lipidos?|gorduras?(?: totais?)?|grasas?|fat|matieres grasses|hidratos(?:\s+de)?\s+carbono|h\.?\s*carbono|carboidratos?|carbohydrates?|glucides|proteinas?|proteins?|proteines|fibras?(?: alimentar(?:es)?)?|fibres?|fiber|(?:dos quais\s+)?(?:acucares|saturados)|sugars?|salt|sal)\b/g;
  const matches = [...content.matchAll(fields)];
  const result: Partial<Record<'calories'|'fat'|'carbs'|'protein'|'fiber', number>> = {};
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const label = match[1];
    const segment = content.slice(match.index! + match[0].length, matches[i + 1]?.index ?? content.length);
    const key = /ener/.test(label) ? 'calories' : /lipid|gordur|grasa|^fat$|matieres/.test(label) ? 'fat' : /carbon|hidrato|glucid/.test(label) ? 'carbs' : /protein/.test(label) ? 'protein' : /fib/.test(label) ? 'fiber' : null;
    if (!key || result[key] !== undefined) continue;
    // Consume the number after this nutrient, not the first number on its line.
    // For multilingual labels only the final alias has numbers after it.
    const value = key === 'calories'
      ? /(\d+(?:[.,]\d+)?)\s*k\s*c\s*a\s*l/.exec(segment)
      : /(?:<\s*)?(\d+(?:[.,]\d+)?)\s*(?:g\b|$)/.exec(segment.trim());
    if (!value) continue;
    const number = Number(value[1].replace(',', '.'));
    if (number >= 0 && number <= (key === 'calories' ? 1000 : 100)) result[key] = number;
  }
  return { values: result, basis: reference[1] === 'ml' ? 'ml' as const : 'g' as const };
}
