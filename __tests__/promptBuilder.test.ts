import { buildSystemPrompt, buildContextString, buildFullPrompt } from '../src/services/ai/promptBuilder';

describe('buildSystemPrompt', () => {
  test('returns a non-empty string', () => {
    const prompt = buildSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  test('instructs AI to respond in Turkish', () => {
    expect(buildSystemPrompt()).toContain('Türkçe');
  });

  test('instructs AI not to give medical advice', () => {
    expect(buildSystemPrompt()).toContain('Tıbbi');
  });
});

describe('buildContextString', () => {
  test('empty context returns empty string', () => {
    expect(buildContextString({})).toBe('');
  });

  test('includes user name when provided', () => {
    expect(buildContextString({ userName: 'Ali' })).toContain('Ali');
  });

  test('maps gender male to Turkish', () => {
    expect(buildContextString({ gender: 'male' })).toContain('Erkek');
  });

  test('maps gender female to Turkish', () => {
    expect(buildContextString({ gender: 'female' })).toContain('Kadın');
  });

  test('maps goal lose to Turkish', () => {
    expect(buildContextString({ goal: 'lose' })).toContain('Kilo vermek');
  });

  test('maps goal gain to Turkish', () => {
    expect(buildContextString({ goal: 'gain' })).toContain('Kilo almak');
  });

  test('maps goal muscle to Turkish', () => {
    expect(buildContextString({ goal: 'muscle' })).toContain('Kas geliştirmek');
  });

  test('maps activity moderate to Turkish', () => {
    expect(buildContextString({ activityLevel: 'moderate' })).toContain('Orta');
  });

  test('includes TDEE when provided', () => {
    expect(buildContextString({ tdee: 2300 })).toContain('2300');
  });

  test('includes todayCalories when provided', () => {
    expect(buildContextString({ todayCalories: 1850 })).toContain('1850');
  });

  test('includes height rounded to int', () => {
    expect(buildContextString({ height: 175.6 })).toContain('176');
  });

  test('includes weight with one decimal', () => {
    expect(buildContextString({ weight: 72.3 })).toContain('72.3');
  });

  test('full context contains all provided fields', () => {
    const ctx = buildContextString({
      userName: 'Mehmet',
      age: 25,
      gender: 'male',
      height: 180,
      weight: 80,
      goal: 'muscle',
      activityLevel: 'active',
      tdee: 2800,
      todayCalories: 2100,
      recentWorkoutSummary: '3 antrenman tamamlandı',
    });
    expect(ctx).toContain('Mehmet');
    expect(ctx).toContain('25');
    expect(ctx).toContain('180');
    expect(ctx).toContain('80.0');
    expect(ctx).toContain('2800');
    expect(ctx).toContain('2100');
    expect(ctx).toContain('3 antrenman');
  });
});

describe('buildFullPrompt', () => {
  test('includes system prompt', () => {
    const full = buildFullPrompt('test mesaj', '');
    expect(full).toContain('Türkçe');
  });

  test('includes user message', () => {
    const full = buildFullPrompt('kaç kalori almalıyım?', '');
    expect(full).toContain('kaç kalori almalıyım?');
  });

  test('includes context section when context provided', () => {
    const full = buildFullPrompt('soru', 'Ad: Ali\nYaş: 30');
    expect(full).toContain('KULLANICI PROFİLİ');
    expect(full).toContain('Ali');
  });

  test('does not include context section when context empty', () => {
    const full = buildFullPrompt('soru', '');
    expect(full).not.toContain('KULLANICI PROFİLİ');
  });

  test('includes user message header', () => {
    const full = buildFullPrompt('soru', '');
    expect(full).toContain('KULLANICI MESAJI');
  });
});
