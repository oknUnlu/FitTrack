import { AIResponse } from './types';

const responses: Record<string, string> = {
  antrenman: 'Bugün için önerim: Düzenli antrenman yapmaya devam et! Hedefine uygun bir program seçmek için Antrenman Planları bölümüne göz atabilirsin.',
  beslenme: 'Dengeli beslenme çok önemli! Protein, karbonhidrat ve yağ oranlarını hedeflerine göre ayarladığından emin ol.',
  kilo: 'Kilo hedefine ulaşmak için tutarlı olmak en önemli faktör. Günlük kalori hedefine sadık kal ve düzenli antrenman yap.',
  protein: 'Protein ihtiyacın hedefine göre değişir. Kas gelişimi için kilogram başına 1.6-2.2g protein tüketmeyi hedefle.',
  su: 'Günlük su ihtiyacın kilogram başına yaklaşık 35ml. Aktif günlerde 500ml daha fazla içmeyi unutma!',
  dinlenme: 'Dinlenme günleri kas gelişimi için çok önemli! Haftada en az 1-2 gün tam dinlenme günü planla.',
  pr: 'Tebrikler! Kişisel rekor kırmak harika bir başarı. Progresif yüklenmeye devam et ama sakatlık riskine dikkat et.',
};

const defaultResponse = 'Fitness yolculuğunda sana yardımcı olmak için buradayım! Beslenme, antrenman veya ilerleme hakkında sorularını sorabilirsin. Detaylı yanıtlar için Gemini API anahtarını Profil ayarlarından ekleyebilirsin.';

export function getFallbackResponse(prompt: string): AIResponse {
  const lower = prompt.toLowerCase();
  const matched = Object.entries(responses).find(([key]) => lower.includes(key));
  return {
    success: true,
    message: matched ? matched[1] : defaultResponse,
    source: 'fallback',
  };
}
