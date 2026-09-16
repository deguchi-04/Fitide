export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code') ?? '';
  if (!/^\d{8,14}$/.test(code)) return Response.json({ error: 'Código inválido.' }, { status: 400 });
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,nutriments,nutrition_data_per`, { headers: { 'User-Agent': 'Fitide/3 personal nutrition tracker' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('upstream');
    const data = await response.json() as { status: number; product?: { product_name?: string; nutriments?: Record<string, number>; nutrition_data_per?: string } };
    if (data.status !== 1 || !data.product) return Response.json({ error: 'Produto não encontrado. Podes usar o rótulo.' }, { status: 404 });
    const n = data.product.nutriments ?? {};
    if (data.product.nutrition_data_per?.includes('ml')) return Response.json({ error: 'Produto por 100 ml: confirma a densidade antes de converter para gramas.' }, { status: 422 });
    const values: Record<string, number> = {};
    for (const [key, source] of Object.entries({ calories: 'energy-kcal', protein: 'proteins', fat: 'fat', carbs: 'carbohydrates', fiber: 'fiber' })) {
      const value = n[`${source}_100g`]; if (typeof value === 'number' && Number.isFinite(value) && value >= 0) values[key] = value;
    }
    return Response.json({ name: data.product.product_name ?? 'Produto', values, source: 'Open Food Facts' });
  } catch { return Response.json({ error: 'Pesquisa indisponível. Tenta novamente.' }, { status: 502 }); }
}
