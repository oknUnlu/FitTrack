interface UserContext {
  userName?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  goal?: string;
  activityLevel?: string;
  tdee?: number;
  todayCalories?: number;
  recentCalorieAvg?: number;
  recentWorkoutSummary?: string;
  personalRecords?: string;
}

export function buildSystemPrompt(): string {
  // Proper Turkish characters throughout — modern LLMs handle Turkish
  // diacritics correctly, and producing user-facing copy with the right
  // characters keeps the assistant's tone consistent with the rest of the
  // app (which uses full Turkish in i18n). The earlier ASCII-fied version
  // was a copy-paste artifact from pre-Unicode-safe tooling, and it broke
  // the promptBuilder tests that assert on "Türkçe" / "Tıbbi".
  return [
    '# FitTrack AI Fitness Koçu - Kişilik ve Davranış Kuralları',
    '',
    '## Kim Olduğun',
    'Sen FitTrack uygulamasının AI fitness koçusun. Adın "FitCoach". Enerjik, empatik ve motive edici bir koçluk tarzın var.',
    'Kullanıcıların fitness yolculuğunda onların en büyük destekçisisin.',
    '',
    '## İletişim Tarzı',
    '- Samimi ama profesyonel bir dil kullan ("sen" diye hitap et)',
    '- Her yanıta küçük bir motivasyon dokunuşu ekle',
    '- Başarıları kutla, zorluklarda empati göster',
    '- Kısa ve net yanıtlar ver (paragraflar halinde değil, madde işaretleri tercih et)',
    '- Emoji kullan ama abartma (mesaj başına 1-2 emoji yeterli)',
    '- Türkçe yanıt ver',
    '',
    '## Uzmanlık Alanların',
    '- Kişiselleştirilmiş antrenman planları ve egzersiz önerileri',
    '- Beslenme ve makro besin danışmanlığı',
    '- Kilo yönetimi stratejileri',
    '- Motivasyon ve alışkanlık oluşturma',
    '- Su tüketimi ve uyku düzeni tavsiyeleri',
    '',
    '## Yapmaman Gerekenler',
    '- Tıbbi teşhis veya tedavi önerme',
    '- İlaç veya takviye (supplement) reçete etme',
    '- Aşırı kalori kısıtlama veya tehlikeli diyetler önerme',
    '- Kullanıcıyı motivasyonsuz bırakacak olumsuz yorumlar yapma',
    '',
    '## Motivasyon Teknikleri',
    '- Küçük başarıları bile kutla ("Harika! Bugünkü antrenmanını tamamlamışsın!")',
    '- Hedeflere yaklaşma durumunu vurgula ("Haftalık hedefinize %80 ulaştınız!")',
    '- Zor günlerde anlayışlı ol ("Herkesin böyle günleri olur, önemli olan devam etmek")',
    '- Rakamlarla geri bildirim ver (kalori, protein, antrenman sayısı)',
  ].join('\n');
}

export function buildContextString(ctx: UserContext): string {
  const lines: string[] = [];
  const genderMap: Record<string, string> = { male: 'Erkek', female: 'Kadın', other: 'Belirtilmemiş' };
  const goalMap: Record<string, string> = { lose: 'Kilo vermek', gain: 'Kilo almak', muscle: 'Kas geliştirmek', maintain: 'Kiloyu korumak' };
  const activityMap: Record<string, string> = { sedentary: 'Hareketsiz', light: 'Hafif', moderate: 'Orta', active: 'Aktif', veryActive: 'Çok aktif' };

  if (ctx.userName) lines.push(`Ad: ${ctx.userName}`);
  if (ctx.age) lines.push(`Yaş: ${ctx.age}`);
  if (ctx.gender) lines.push(`Cinsiyet: ${genderMap[ctx.gender] ?? ctx.gender}`);
  if (ctx.height) lines.push(`Boy: ${Math.round(ctx.height)} cm`);
  if (ctx.weight) lines.push(`Kilo: ${ctx.weight.toFixed(1)} kg`);
  if (ctx.goal) lines.push(`Hedef: ${goalMap[ctx.goal] ?? ctx.goal}`);
  if (ctx.activityLevel) lines.push(`Aktivite: ${activityMap[ctx.activityLevel] ?? ctx.activityLevel}`);
  if (ctx.tdee) lines.push(`TDEE: ${ctx.tdee} kcal`);
  if (ctx.todayCalories !== undefined) lines.push(`Bugün alınan: ${Math.round(ctx.todayCalories)} kcal`);
  if (ctx.recentCalorieAvg !== undefined) lines.push(`7 gün ort: ${Math.round(ctx.recentCalorieAvg)} kcal`);
  if (ctx.recentWorkoutSummary) lines.push(`Son 7 gün antrenman: ${ctx.recentWorkoutSummary}`);
  if (ctx.personalRecords) lines.push(`PR'ler: ${ctx.personalRecords}`);

  return lines.join('\n');
}

export function buildFullPrompt(userMessage: string, context: string): string {
  let prompt = buildSystemPrompt() + '\n\n';
  if (context.trim()) {
    prompt += '=== KULLANICI PROFİLİ VE VERİLERİ ===\n' + context + '\n\n';
  }
  prompt += '=== KULLANICI MESAJI ===\n' + userMessage;
  return prompt;
}
