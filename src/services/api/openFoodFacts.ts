const BASE_URL = 'https://world.openfoodfacts.org';

interface OFFNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
}

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_tr?: string;
  nutriments?: OFFNutriments;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  nameTr: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  barcode: string | null;
}

export async function searchFoods(query: string, pageSize = 20): Promise<FoodSearchResult[]> {
  try {
    const url = `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=${pageSize}`;
    const response = await fetch(url);
    const data = await response.json();

    return (data.products || [])
      .filter((p: OFFProduct) => p.product_name && p.nutriments)
      .map((p: OFFProduct): FoodSearchResult => ({
        id: `off_${p.code || p.product_name?.replace(/\s+/g, '_').toLowerCase() || 'unknown'}`,
        name: p.product_name!,
        nameTr: p.product_name_tr || null,
        calories: p.nutriments?.['energy-kcal_100g'] ?? 0,
        protein: p.nutriments?.proteins_100g ?? 0,
        carbs: p.nutriments?.carbohydrates_100g ?? 0,
        fat: p.nutriments?.fat_100g ?? 0,
        fiber: p.nutriments?.fiber_100g ?? null,
        sugar: p.nutriments?.sugars_100g ?? null,
        barcode: p.code || null,
      }));
  } catch {
    return [];
  }
}

export async function getProductByBarcode(barcode: string): Promise<FoodSearchResult | null> {
  try {
    const url = `${BASE_URL}/api/v2/product/${barcode}.json`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 1 || !data.product) return null;
    const p: OFFProduct = data.product;
    const n = p.nutriments;
    if (!n) return null;

    return {
      id: `off_${barcode}`,
      name: p.product_name || 'Unknown Product',
      nameTr: p.product_name_tr || null,
      calories: n['energy-kcal_100g'] ?? 0,
      protein: n.proteins_100g ?? 0,
      carbs: n.carbohydrates_100g ?? 0,
      fat: n.fat_100g ?? 0,
      fiber: n.fiber_100g ?? null,
      sugar: n.sugars_100g ?? null,
      barcode,
    };
  } catch {
    return null;
  }
}
