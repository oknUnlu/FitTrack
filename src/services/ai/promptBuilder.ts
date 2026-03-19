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
  return [
    'Sen FitTrack uygulamasının AI fitness koçusun. Türkçe yanıt ver.',
    'Kullanıcıya kişiselleştirilmiş fitness ve beslenme tavsiyeleri sun.',
    'Yanıtların kısa, net ve motive edici olsun.',
    'Tıbbi tavsiye verme, sadece genel fitness ve beslenme önerileri sun.',
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
