import { Platform } from 'react-native';
import { apiPost } from '../api/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { useConsentStore } from '../../store/consentStore';

/**
 * AI Calorie Recognition response — every numeric is the TOTAL for the
 * portion visible in the photo (not per-100g). See the matching server
 * type at `functions/src/_lib/types.ts` for the full contract.
 *
 * `servingDescription` is the short Turkish phrase the model used to
 * describe the visible portion ("1 dilim", "1 kase"); surfaced verbatim
 * in the AI estimation modal. Optional because legacy responses from
 * pre-refactor builds may not include it.
 */
export interface RecognizedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingUnit: string;
  servingDescription?: string;
  confidence: string;
}

const MAX_IMAGE_DIMENSION = 512;

async function resizeImageIfNeeded(imageUri: string): Promise<string> {
  if (Platform.OS === 'web') return imageUri;

  try {
    const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
    const result = await manipulateAsync(
      imageUri,
      [{ resize: { width: MAX_IMAGE_DIMENSION } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    // Fallback to original if resize fails
    return imageUri;
  }
}

export async function recognizeFoodFromImage(imageUri: string): Promise<RecognizedFood[]> {
  if (!useConsentStore.getState().hasGranted('aiDataSharing')) {
    throw new Error('AI_CONSENT_REQUIRED');
  }

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
    // Native: use expo-file-system legacy API (new File/Directory API doesn't yet expose base64 reads)
    const { readAsStringAsync } = require('expo-file-system/legacy');
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
