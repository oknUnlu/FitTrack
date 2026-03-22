import { GoogleGenerativeAI } from '@google/generative-ai';
import { readAsStringAsync } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_KEY_STORAGE = 'gemini_api_key_plain';

export interface RecognizedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingUnit: string;
  confidence: string;
}

export async function recognizeFoodFromImage(imageUri: string): Promise<RecognizedFood[]> {
  const apiKey = await AsyncStorage.getItem(GEMINI_KEY_STORAGE);
  if (!apiKey) {
    throw new Error('Gemini API anahtarı ayarlanmamış. Profil > AI Koç bölümünden ekleyin.');
  }

  // Read image as base64
  const base64 = await readAsStringAsync(imageUri, {
    encoding: 'base64',
  });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Analyze this food image and identify all food items visible.
For each item, estimate the nutritional values per serving.

Return ONLY a valid JSON array with this format (no markdown, no explanation):
[
  {
    "name": "Food name in Turkish",
    "calories": 250,
    "protein": 15,
    "carbs": 30,
    "fat": 8,
    "servingSize": 100,
    "servingUnit": "g",
    "confidence": "high"
  }
]

If no food is detected, return an empty array: []
Confidence can be "high", "medium", or "low".
Always respond with ONLY the JSON array, nothing else.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64,
      },
    },
  ]);

  const text = result.response.text().trim();

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text;
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const foods: RecognizedFood[] = JSON.parse(jsonStr);
    return foods.filter((f) => f.name && f.calories >= 0);
  } catch {
    console.warn('Failed to parse food recognition response:', text);
    return [];
  }
}
