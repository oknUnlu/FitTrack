import { Platform } from 'react-native';
import { apiPost } from '../api/apiClient';
import { API_ENDPOINTS } from '../../config/api';

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

const MAX_IMAGE_DIMENSION = 512;

async function resizeImageIfNeeded(imageUri: string): Promise<string> {
  if (Platform.OS === 'web') return imageUri;

  try {
    const ImageManipulator = require('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: MAX_IMAGE_DIMENSION } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    // Fallback to original if resize fails
    return imageUri;
  }
}

export async function recognizeFoodFromImage(imageUri: string): Promise<RecognizedFood[]> {
  // Resize image to reduce payload size and Gemini token cost
  const optimizedUri = await resizeImageIfNeeded(imageUri);

  let base64: string;

  if (Platform.OS === 'web') {
    // Web: fetch the blob and convert to base64
    const response = await fetch(optimizedUri);
    const blob = await response.blob();
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Strip "data:image/jpeg;base64," prefix
        resolve(dataUrl.split(',')[1] || dataUrl);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // Native: use expo-file-system
    const { readAsStringAsync } = require('expo-file-system');
    base64 = await readAsStringAsync(optimizedUri, { encoding: 'base64' });
  }

  const data = await apiPost<{ success: boolean; foods: RecognizedFood[] }>(
    API_ENDPOINTS.foodRecognition,
    {
      image: base64,
      mimeType: 'image/jpeg',
    }
  );

  if (!data.success) {
    return [];
  }

  return data.foods;
}
