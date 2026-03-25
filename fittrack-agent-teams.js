const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber, PageBreak, TabStopType, TabStopPosition
} = require("docx");

// ── Colors ──
const PRIMARY = "1B5E20";
const SECONDARY = "2E7D32";
const ACCENT = "4CAF50";
const DARK = "212121";
const MEDIUM = "616161";
const LIGHT_BG = "E8F5E9";
const WHITE = "FFFFFF";
const BORDER_COLOR = "C8E6C9";

// ── Helpers ──
const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: PRIMARY })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color: SECONDARY })]
  });
}

function heading3(text) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color: DARK })]
  });
}

function bodyText(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: opts.color || MEDIUM, ...opts })]
  });
}

function codeBlock(lines) {
  return lines.map(line =>
    new Paragraph({
      spacing: { after: 40 },
      indent: { left: 360 },
      children: [new TextRun({ text: line, font: "Consolas", size: 18, color: "37474F" })]
    })
  );
}

function teamHeaderRow() {
  return new TableRow({
    tableHeader: true,
    children: ["Ekip Ad\u0131", "Sorumluluk Alan\u0131", "Dosya Kapsam\u0131"].map((t, i) =>
      new TableCell({
        borders,
        width: { size: [2800, 3560, 3000][i], type: WidthType.DXA },
        shading: { fill: PRIMARY, type: ShadingType.CLEAR },
        margins: cellMargins,
        verticalAlign: "center",
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, font: "Arial", size: 20, bold: true, color: WHITE })] })]
      })
    )
  });
}

function teamRow(name, responsibility, files) {
  return new TableRow({
    children: [name, responsibility, files].map((t, i) =>
      new TableCell({
        borders,
        width: { size: [2800, 3560, 3000][i], type: WidthType.DXA },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: t, font: "Arial", size: 19, color: DARK })] })]
      })
    )
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: ACCENT, space: 1 } },
    children: [new TextRun({ text: "", size: 2 })]
  });
}

function promptBlock(title, promptText) {
  const parts = [];
  parts.push(heading3(title));
  const lines = promptText.split("\n");
  for (const line of lines) {
    parts.push(new Paragraph({
      spacing: { after: 30 },
      indent: { left: 240 },
      shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
      children: [new TextRun({ text: line || " ", font: "Consolas", size: 18, color: "37474F" })]
    }));
  }
  return parts;
}

// ═══════════════════════════════════════════════════
// DOCUMENT
// ═══════════════════════════════════════════════════

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: PRIMARY },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: SECONDARY },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } }
      ]},
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
      ]}
    ]
  },
  sections: [
    // ── COVER PAGE ──
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "FitTrack", font: "Arial", size: 72, bold: true, color: PRIMARY })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "Claude Code Agent Teams", font: "Arial", size: 36, color: SECONDARY })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: "Yap\u0131land\u0131rma & Prompt K\u0131lavuzu", font: "Arial", size: 28, color: ACCENT })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 3, color: ACCENT, space: 20 } },
          spacing: { before: 600, after: 200 },
          children: [new TextRun({ text: "React Native (Expo) \u2022 TypeScript \u2022 Zustand \u2022 SQLite \u2022 Gemini AI", font: "Arial", size: 20, color: MEDIUM })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "Haz\u0131rlayan: Claude \u2022 Tarih: 25 Mart 2026", font: "Arial", size: 20, color: MEDIUM })]
        }),
      ]
    },

    // ── MAIN CONTENT ──
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: "FitTrack Agent Teams K\u0131lavuzu", font: "Arial", size: 16, color: MEDIUM, italics: true }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Sayfa ", font: "Arial", size: 16, color: MEDIUM }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: MEDIUM }),
            ]
          })]
        })
      },
      children: [
        // ═══ 1. GİRİŞ ═══
        heading1("1. Giri\u015F ve Genel Bak\u0131\u015F"),
        bodyText("Bu belge, FitTrack mobil uygulamas\u0131 i\u00E7in Claude Code Agent Teams yap\u0131land\u0131rmas\u0131n\u0131 tan\u0131mlar. Her ekip, projenin belirli bir alan\u0131ndan sorumludur ve paralel \u00E7al\u0131\u015Farak geli\u015Ftirme s\u00FCrecini h\u0131zland\u0131r\u0131r."),
        bodyText("Proje: React Native (Expo SDK 54), TypeScript, Zustand state management, expo-sqlite veritaban\u0131, Gemini AI entegrasyonu, 8 dil deste\u011Fi (i18n), 14+ ekran, servis tabanl\u0131 mimari."),

        heading2("Aktivasyon"),
        ...codeBlock([
          "# Ortam de\u011Fi\u015Fkeni ile etkinle\u015Ftirme",
          "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1",
          "",
          "# Veya settings.json i\u00E7inde",
          '{',
          '  "env": {',
          '    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"',
          '  }',
          '}',
        ]),

        divider(),

        // ═══ 2. EKİP HARİTASI ═══
        heading1("2. Ekip Haritas\u0131"),
        bodyText("A\u015Fa\u011F\u0131daki tablo, FitTrack projesine \u00F6zel olarak tan\u0131mlanan 6 agent ekibini ve sorumluluk alanlar\u0131n\u0131 g\u00F6sterir."),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 3560, 3000],
          rows: [
            teamHeaderRow(),
            teamRow("UI/UX Agent", "Ekranlar, navigasyon, tema, komponentler", "screens/, components/, theme/, navigation/"),
            teamRow("Backend/Data Agent", "Veritaban\u0131, servisler, DAO katman\u0131, API", "services/database/, services/api/, store/"),
            teamRow("AI/ML Agent", "Gemini entegrasyonu, prompt builder, AI coach", "services/ai/, screens/AICoach/"),
            teamRow("Feature Agent", "Workout, kalori, wellness, supplements", "screens/Workout/, Calorie/, Wellness/, ..."),
            teamRow("i18n/QA Agent", "Lokalizasyon, testler, lint, kalite", "i18n/, __tests__/, babel, eslint"),
            teamRow("DevOps/Infra Agent", "Build, config, performans, g\u00FCvenlik", "app.json, tsconfig, package.json, assets/"),
          ]
        }),

        new Paragraph({ spacing: { before: 200 } }),

        divider(),

        // ═══ 3. BAŞLATMA PROMPT'U ═══
        heading1("3. Ana Ba\u015Flatma Prompt\u2019u (Lead Agent)"),
        bodyText("A\u015Fa\u011F\u0131daki prompt, ekip liderini ba\u015Flat\u0131r ve 6 teammate\u2019i olu\u015Fturmas\u0131n\u0131 sa\u011Flar. Bunu Claude Code\u2019a do\u011Frudan yap\u0131\u015Ft\u0131r\u0131n."),

        ...promptBlock("Lead Agent Ba\u015Flatma Prompt\u2019u", `Sen FitTrack projesinin ba\u015F mimarısın. Bu bir React Native (Expo SDK 54)
fitness takip uygulaması. Tech stack: TypeScript, Zustand, expo-sqlite,
Gemini AI, react-navigation, react-native-paper, 8 dil i18n desteği.

Şimdi 6 teammate oluştur ve her birine aşağıdaki görevleri ata:

1. "ui-agent" - UI/UX uzmanı: Ekranlar, komponentler, tema, navigasyon
2. "data-agent" - Backend/Data uzmanı: SQLite DB, DAO, servisler, store
3. "ai-agent" - AI/ML uzmanı: Gemini entegrasyonu, prompt builder, AI Coach
4. "feature-agent" - Feature uzmanı: Workout, kalori, wellness modülleri
5. "i18n-qa-agent" - i18n & QA uzmanı: Çeviriler, testler, lint, kalite
6. "devops-agent" - DevOps uzmanı: Build config, performans, güvenlik

KURALLAR:
- Her teammate SADECE kendi dosya kapsamında çalışır
- Aynı dosyayı iki agent düzenlemez
- Değişiklikler önce teammate tarafından test edilir
- Cross-cutting değişikliklerde bana (lead) danışılır
- Her teammate değişiklik yapmadan önce plan onayı ister

Tüm teammate'leri oluşturduktan sonra, her birine CLAUDE.md'deki proje
kurallarını hatırlat ve mevcut branch durumunu kontrol et.`),

        new Paragraph({ children: [new PageBreak()] }),

        // ═══ 4. EKİP PROMPT'LARI ═══
        heading1("4. Ekip Prompt\u2019lar\u0131 (Teammate Prompts)"),
        bodyText("Her bir teammate i\u00E7in ba\u015Flatma prompt\u2019lar\u0131 a\u015Fa\u011F\u0131da verilmi\u015Ftir. Lead agent bu prompt\u2019lar\u0131 teammate olu\u015Ftururken kullan\u0131r."),

        divider(),

        // ── 4.1 UI/UX AGENT ──
        heading2("4.1 UI/UX Agent (ui-agent)"),
        ...promptBlock("Spawn Prompt", `Sen FitTrack'in UI/UX uzmanısın.

KAPSAM:
- src/screens/ altındaki tüm ekranlar (14+ screen)
- src/components/ (BarcodeScanner, Logo, ProgressRing, RestTimerBanner, ShimmerEffect)
- src/navigation/AppNavigation.tsx
- src/theme/theme.ts (lightTheme, darkTheme)

TECH STACK:
- react-native-paper (Material Design 3 component library)
- react-navigation v7 (bottom tabs + native stack)
- react-native-reanimated (animasyonlar)
- react-native-chart-kit (grafikler)
- react-native-svg
- SafeAreaProvider, GestureHandlerRootView

KURALLAR:
1. Tema değişiklikleri theme.ts üzerinden yapılır, inline style KULLANMA
2. Tüm text'ler i18n key'leri üzerinden gelir, hardcoded string YAZMA
3. Her ekran responsive olmalı (SafeArea + useSafeAreaInsets)
4. Dark mode desteği zorunlu (useThemeStore isDarkMode)
5. Yeni komponent eklerken mevcut pattern'ı takip et
6. Navigation type-safety: RootStackParamList ve TabParamList'i güncelle
7. Performance: FlatList kullan, ScrollView içinde map YAPMA
8. Accessibility: accessibilityLabel ekle

MEVCUT EKRANLAR:
Dashboard, Calorie, Workout (3 screen), Progress, Profile,
AICoach, Tools, Achievements, BodyMetrics, Supplements,
Wellness, HealthHub, Social, Onboarding

Değişiklik yapmadan önce planını bana bildir ve onay bekle.`),

        divider(),

        // ── 4.2 BACKEND/DATA AGENT ──
        heading2("4.2 Backend/Data Agent (data-agent)"),
        ...promptBlock("Spawn Prompt", `Sen FitTrack'in Backend/Data uzmanısın.

KAPSAM:
- src/services/database/ (database.ts, schema.ts, 6 DAO dosyası)
- src/services/api/openFoodFacts.ts
- src/store/ (userStore, themeStore, mealStore - Zustand)
- src/utils/ (helpers, calculations, activityUtils)

VERİTABANI ŞEMASI (expo-sqlite):
- users, food_items, meal_logs, exercises, workout_sessions
- exercise_sets, workout_templates, body_metrics, water_logs
- ai_conversations
- İndeksler: meal_logs_date, workout_sessions_date, exercise_sets_session,
  water_logs_date, ai_conversations_user

KURALLAR:
1. Tüm DB işlemleri DAO pattern ile yapılır (foodDao, mealDao, workoutDao vb.)
2. Migration desteği: schema değişikliklerinde version kontrolü yap
3. Zustand store'ları minimal tut, iş mantığı servislerde olsun
4. AsyncStorage sadece basit key-value için (API key, onboarding state)
5. expo-sqlite API'sını kullan, raw SQL yerine parameterized query tercih et
6. Error handling: try-catch + console.warn pattern'ı
7. Type safety: Tüm DAO fonksiyonları tipli olmalı
8. Web platformunda SQLite yok - Platform.OS kontrolü zorunlu

STORE YAPISI (Zustand v5):
- userStore: isOnboarded, isLoading, loadOnboardingState
- themeStore: isDarkMode toggle
- mealStore: günlük öğün verileri

Değişiklik yapmadan önce planını bana bildir ve onay bekle.`),

        divider(),

        // ── 4.3 AI/ML AGENT ──
        heading2("4.3 AI/ML Agent (ai-agent)"),
        ...promptBlock("Spawn Prompt", `Sen FitTrack'in AI/ML uzmanısın.

KAPSAM:
- src/services/ai/ (aiService, geminiCloud, fallbackAI, foodRecognition,
  promptBuilder, rateLimiter, types, index)
- src/screens/AICoach/AICoachScreen.tsx
- src/services/database/aiDao.ts (konuşma geçmişi)

AI STACK:
- @google/generative-ai (Gemini API)
- API key: AsyncStorage'dan 'gemini_api_key_plain' ile okunur
- initializeGemini() App.tsx'de çağrılır

KURALLAR:
1. Gemini API çağrıları rateLimiter üzerinden geçmeli
2. API key yoksa veya hata olursa fallbackAI devreye girmeli
3. promptBuilder: Kullanıcı verilerini (boy, kilo, hedef, TDEE) prompt'a göm
4. Tüm AI yanıtları Türkçe dahil çoklu dil desteklemeli
5. Token kullanımını minimize et - gereksiz context gönderme
6. foodRecognition: Kamera ile yemek tanıma, sonuçları food_items'a kaydet
7. aiDao: Konuşma geçmişini ai_conversations tablosuna yaz
8. Error handling: Network hatası, rate limit, invalid response
9. Streaming response desteğini değerlendir

FALLBACK STRATEJİSİ:
Gemini erişilemezse > fallbackAI.ts > önceden hazırlanmış template yanıtlar

Değişiklik yapmadan önce planını bana bildir ve onay bekle.`),

        new Paragraph({ children: [new PageBreak()] }),

        divider(),

        // ── 4.4 FEATURE AGENT ──
        heading2("4.4 Feature Agent (feature-agent)"),
        ...promptBlock("Spawn Prompt", `Sen FitTrack'in Feature Development uzmanısın.

KAPSAM:
- src/screens/Workout/ (WorkoutScreen, ActiveWorkoutScreen, SessionDetailScreen)
- src/screens/Calorie/CalorieScreen.tsx
- src/screens/Wellness/WellnessScreen.tsx
- src/screens/Supplements/SupplementsScreen.tsx
- src/screens/BodyMetrics/BodyMetricsScreen.tsx
- src/screens/HealthHub/HealthHubScreen.tsx
- src/screens/Social/SocialScreen.tsx
- src/screens/Achievements/AchievementsScreen.tsx
- src/services/mealPlanner/mealPlanService.ts
- src/services/supplements/supplementService.ts
- src/services/achievements/achievementService.ts
- src/services/wellness/wellnessService.ts
- src/services/health/healthService.ts
- src/services/social/challengeService.ts
- src/services/notifications/notificationService.ts
- src/hooks/useDashboard.ts
- src/assets/data/ (exercises_tr.json, foods_tr.json, workout_templates.json)

KURALLAR:
1. Her feature kendi servis dosyasında iş mantığını tutar
2. Ekran dosyaları sadece UI render ve servis çağrısı yapar
3. Data dosyaları (JSON) için type tanımları zorunlu
4. Workout flow: Template seç > ActiveWorkout > Set kaydet > SessionDetail
5. Kalori flow: Yemek ara/barkod tara > Öğüne ekle > Günlük özet
6. Yeni feature eklerken: Screen + Service + DAO (gerekirse) + Navigation + i18n
7. expo-notifications API'sını notificationService üzerinden kullan
8. useDashboard hook'u tüm dashboard verilerini aggregate eder

MEVCUT SERVİSLER:
mealPlanService, supplementService, achievementService,
wellnessService, healthService, challengeService, notificationService

Değişiklik yapmadan önce planını bana bildir ve onay bekle.`),

        divider(),

        // ── 4.5 i18n/QA AGENT ──
        heading2("4.5 i18n & QA Agent (i18n-qa-agent)"),
        ...promptBlock("Spawn Prompt", `Sen FitTrack'in i18n ve Kalite Güvence uzmanısın.

KAPSAM:
- src/i18n/ (index.ts, types.ts, LanguageContext.tsx)
- src/i18n/locales/ (en.ts, tr.ts, es.ts, pt.ts, hi.ts, ko.ts, id.ts, ja.ts)
- __tests__/ (calculations.test.ts, activityUtils.test.ts, promptBuilder.test.ts)
- babel.config.js, tsconfig.json (lint/build config)

i18n SİSTEMİ:
- LanguageContext + useLanguage hook
- 8 dil: İngilizce, Türkçe, İspanyolca, Portekizce, Hintçe, Korece, Endonezce, Japonca
- Type-safe çeviri key'leri (types.ts)
- Tüm ekran metinleri t.xxx.yyy formatında

KURALLAR:
1. Yeni UI string eklendiğinde TÜM 8 locale dosyasına çeviri ekle
2. types.ts'deki TranslationKeys interface'ini güncelle
3. Eksik çeviri key'lerini tespit et ve raporla
4. Jest testleri: ts-jest preset, node environment
5. Her yeni util/service fonksiyonu için test yaz
6. Test coverage raporla: hangi servisler test edilmemiş?
7. TypeScript strict mode aktif - any kullanma
8. ESLint kurallarına uy (@typescript-eslint)
9. Çeviri tutarlılığı: Aynı kavram her dilde aynı terimle

TEST STRATEJİSİ:
- Unit test: utils/, services/ (iş mantığı)
- Mevcut testler: calculations, activityUtils, promptBuilder
- Eksik testler: DAO'lar, store'lar, servisler

GÖREVLER:
- Eksik çeviri key'lerini bul ve ekle
- Mevcut testleri çalıştır, kırık olanları düzelt
- Yeni servisler için test dosyaları oluştur
- TypeScript hata kontrolü yap

Değişiklik yapmadan önce planını bana bildir ve onay bekle.`),

        divider(),

        // ── 4.6 DEVOPS AGENT ──
        heading2("4.6 DevOps/Infra Agent (devops-agent)"),
        ...promptBlock("Spawn Prompt", `Sen FitTrack'in DevOps ve Altyapı uzmanısın.

KAPSAM:
- package.json (dependencies, scripts, jest config)
- app.json (Expo konfigürasyonu)
- tsconfig.json (TypeScript, path aliases)
- babel.config.js (module-resolver)
- assets/ (uygulama ikonları, splash screen)
- dist/ (build output)

TECH STACK:
- Expo SDK 54, React Native 0.81.5, React 19.1
- TypeScript 5.9 (strict mode)
- Jest 29 + ts-jest
- ESLint 8 + @typescript-eslint
- Path aliases: @/*, @components/*, @screens/*, @services/*, vb.

KURALLAR:
1. Dependency güncellemelerinde breaking change kontrolü yap
2. Path alias'ları tsconfig ve babel.config'de senkron tut
3. expo-sqlite, expo-camera vb. native modüller versiyon uyumlu olmalı
4. Build script'leri: start, android, ios, web, test, lint
5. Bundle size'ı izle - gereksiz dependency ekleme
6. Güvenlik: API key'ler expo-secure-store'da, .env dosyası .gitignore'da
7. Performance: Hermes engine, tree-shaking, lazy loading
8. CI/CD pipeline önerisi hazırla (GitHub Actions)

GÜVENLİK KONTROL LİSTESİ:
- API key exposure kontrolü
- AsyncStorage'da hassas veri var mı?
- Network request'ler HTTPS mi?
- expo-secure-store kullanımı doğru mu?

PERFORMANS KONTROL LİSTESİ:
- Bundle size analizi
- Gereksiz re-render tespiti
- Image optimization
- SQLite query performansı

Değişiklik yapmadan önce planını bana bildir ve onay bekle.`),

        new Paragraph({ children: [new PageBreak()] }),

        // ═══ 5. İŞ AKIŞI ═══
        heading1("5. \u0130\u015F Ak\u0131\u015F\u0131 ve Koordinasyon"),

        heading2("5.1 G\u00F6rev Atama S\u00FCreci"),
        bodyText("Lead agent, g\u00F6revleri shared task list \u00FCzerinden atar. Her teammate kendi g\u00F6revini claim eder ve tamamlad\u0131\u011F\u0131nda i\u015Faretler."),

        ...promptBlock("G\u00F6rev Atama \u00D6rne\u011Fi", `# Lead agent'a verilecek görev atama prompt'u:

Aşağıdaki görevleri ekibe dağıt:

TASK-1 [ui-agent]: Dashboard ekranına haftalık özet kartı ekle
  - Bağımlılık: data-agent'ın useDashboard hook güncellemesi
  - Dosyalar: DashboardScreen.tsx, theme.ts

TASK-2 [data-agent]: useDashboard hook'una haftalık aggregate ekle
  - Bağımlılık: Yok (ilk başlamalı)
  - Dosyalar: useDashboard.ts, workoutDao.ts, mealDao.ts

TASK-3 [ai-agent]: AI Coach'a haftalık performans analizi ekle
  - Bağımlılık: TASK-2 tamamlanmalı
  - Dosyalar: promptBuilder.ts, AICoachScreen.tsx

TASK-4 [i18n-qa-agent]: Yeni string'ler için 8 dil çevirisi
  - Bağımlılık: TASK-1 ve TASK-3 tamamlanmalı
  - Dosyalar: locales/*.ts, types.ts

TASK-5 [feature-agent]: Achievements'a "haftalık tutarlılık" rozeti
  - Bağımlılık: TASK-2
  - Dosyalar: achievementService.ts, AchievementsScreen.tsx

TASK-6 [devops-agent]: Bundle size kontrolü ve test çalıştır
  - Bağımlılık: Tüm task'lar tamamlanmalı
  - Dosyalar: package.json, jest config

Sıralama: TASK-2 > (TASK-1, TASK-3, TASK-5 paralel) > TASK-4 > TASK-6`),

        divider(),

        heading2("5.2 Dosya \u00C7ak\u0131\u015Fma \u00D6nleme Matrisi"),
        bodyText("A\u015Fa\u011F\u0131daki matris, hangi agent\u2019\u0131n hangi dosyalar\u0131 d\u00FCzenleyebilece\u011Fini belirler. \u00C7ak\u0131\u015Fma durumunda lead agent arabuluculuk yapar."),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3120, 3120, 3120],
          rows: [
            new TableRow({
              children: ["Dosya/Klas\u00F6r", "Primary Owner", "Secondary (Read-Only)"].map((t, i) =>
                new TableCell({
                  borders,
                  width: { size: 3120, type: WidthType.DXA },
                  shading: { fill: PRIMARY, type: ShadingType.CLEAR },
                  margins: cellMargins,
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, font: "Arial", size: 19, bold: true, color: WHITE })] })]
                })
              )
            }),
            ...[ 
              ["src/screens/*", "ui-agent / feature-agent", "i18n-qa-agent"],
              ["src/components/*", "ui-agent", "feature-agent"],
              ["src/services/database/*", "data-agent", "feature-agent"],
              ["src/services/ai/*", "ai-agent", "data-agent"],
              ["src/store/*", "data-agent", "ui-agent"],
              ["src/i18n/*", "i18n-qa-agent", "ui-agent"],
              ["__tests__/*", "i18n-qa-agent", "T\u00FCm agentlar"],
              ["*.json / *.config.*", "devops-agent", "T\u00FCm agentlar"],
            ].map(([file, primary, secondary]) =>
              new TableRow({
                children: [file, primary, secondary].map((t, i) =>
                  new TableCell({
                    borders,
                    width: { size: 3120, type: WidthType.DXA },
                    margins: cellMargins,
                    children: [new Paragraph({ children: [new TextRun({ text: t, font: "Arial", size: 18, color: DARK })] })]
                  })
                )
              })
            )
          ]
        }),

        divider(),

        heading2("5.3 \u0130leti\u015Fim Protokol\u00FC"),
        bodyText("Teammate\u2019ler aras\u0131 do\u011Frudan mesajla\u015Fma (peer-to-peer) desteklenir. A\u015Fa\u011F\u0131da tipik senaryolar:"),

        ...promptBlock("Senaryo 1: Cross-Dependency", `# feature-agent -> data-agent mesajı:
"Workout SessionDetail ekranına toplam volume (set * rep * weight)
göstermek istiyorum. workoutDao'ya getSessionVolume(sessionId) fonksiyonu
ekleyebilir misin? Return type: { totalVolume: number, exerciseVolumes: 
Array<{ exerciseId: string, volume: number }> }"`),

        ...promptBlock("Senaryo 2: i18n Sync", `# i18n-qa-agent -> ui-agent mesajı:
"DashboardScreen'de 3 adet hardcoded string tespit ettim:
- Satır 45: 'Welcome back' -> t.dashboard.welcomeBack kullan
- Satır 112: 'No data' -> t.dashboard.noData kullan
- Satır 158: 'See all' -> t.dashboard.seeAll kullan
Bu key'leri tüm locale dosyalarına ekledim, sen UI tarafını güncelle."`),

        ...promptBlock("Senaryo 3: AI Integration", `# ai-agent -> feature-agent mesajı:
"foodRecognition servisine yeni bir analyzeNutrition(imageBase64) 
fonksiyonu ekledim. CalorieScreen'deki kamera butonundan çağırabilirsin.
Response type: { foods: Array<{ name: string, calories: number, 
protein: number, carbs: number, fat: number, confidence: number }> }
Confidence < 0.7 ise kullanıcıya onay sor."`),

        new Paragraph({ children: [new PageBreak()] }),

        // ═══ 6. CLAUDE.md ═══
        heading1("6. CLAUDE.md \u0130\u00E7eri\u011Fi"),
        bodyText("Proje k\u00F6k\u00FCne eklenecek CLAUDE.md dosyas\u0131. T\u00FCm teammate\u2019ler bu kurallar\u0131 otomatik y\u00FCkler."),

        ...codeBlock([
          "# FitTrack - Proje Kuralları",
          "",
          "## Tech Stack",
          "- React Native 0.81.5 + Expo SDK 54",
          "- TypeScript 5.9 (strict mode)",
          "- Zustand v5 (state management)",
          "- expo-sqlite (local database)",
          "- @google/generative-ai (Gemini)",
          "- react-native-paper (UI kit)",
          "- react-navigation v7",
          "",
          "## Mimari Kurallar",
          "- Screen -> Service -> DAO pattern",
          "- Zustand store minimal, iş mantığı servislerde",
          "- Tüm metinler i18n üzerinden (8 dil)",
          "- Dark mode desteği zorunlu",
          "- Platform.OS === 'web' kontrolü (SQLite yok)",
          "",
          "## Kod Standartları",
          "- TypeScript strict, 'any' yasak",
          "- Functional components + hooks only",
          "- Path alias kullan: @screens/, @services/ vb.",
          "- ESLint kurallarına uy",
          "- Her yeni fonksiyon için JSDoc yaz",
          "",
          "## Dosya Yapısı",
          "src/",
          "  screens/     -> UI ekranları (her biri kendi klasöründe)",
          "  components/  -> Paylaşılan komponentler",
          "  services/    -> İş mantığı (database, ai, health, vb.)",
          "  store/       -> Zustand store'ları",
          "  i18n/        -> Çoklu dil desteği",
          "  hooks/       -> Custom hook'lar",
          "  theme/       -> Tema tanımları",
          "  utils/       -> Yardımcı fonksiyonlar",
          "  assets/data/ -> Statik veri (JSON)",
          "",
          "## Git Kuralları",
          "- Branch: feature/<agent>/<task-id>",
          "- Commit: feat|fix|refactor|test(scope): açıklama",
          "- PR açmadan önce: lint + test + type-check",
          "- Merge conflict'lerde lead agent karar verir",
        ]),

        divider(),

        // ═══ 7. HIZLI BAŞLANGIÇ ═══
        heading1("7. H\u0131zl\u0131 Ba\u015Flang\u0131\u00E7 Komutlar\u0131"),
        bodyText("Claude Code terminal\u2019inde s\u0131ras\u0131yla \u00E7al\u0131\u015Ft\u0131r\u0131lacak komutlar:"),

        ...codeBlock([
          "# 1. Agent Teams'i etkinleştir",
          "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1",
          "",
          "# 2. Claude Code'u başlat",
          "claude",
          "",
          "# 3. Lead agent prompt'unu yapıştır (Bölüm 3)",
          "# Claude otomatik olarak 6 teammate oluşturacak",
          "",
          "# 4. Teammate'ler arası geçiş",
          "# Shift+Down: Sonraki teammate",
          "# Shift+Up: Önceki teammate",
          "",
          "# 5. Ekibi temizle",
          "# 'Clean up the team' yaz",
        ]),

        divider(),

        heading1("8. \u00D6nemli Notlar ve S\u0131n\u0131rlamalar"),
        bodyText("Agent Teams deneysel bir \u00F6zelliktir. A\u015Fa\u011F\u0131daki s\u0131n\u0131rlamalar\u0131 g\u00F6z \u00F6n\u00FCnde bulundurun:"),

        ...["Token maliyeti her teammate ile lineer artar; 6 teammate = 6x maliyet.",
            "Ayn\u0131 dosyay\u0131 iki agent d\u00FCzenlerse son yazan kazan\u0131r (\u00E7ak\u0131\u015Fma riski). Matrise uyun.",
            "/resume ve /rewind komutlar\u0131 teammate\u2019leri geri y\u00FCklemez.",
            "Bir session\u2019da tek ekip \u00E7al\u0131\u015F\u0131r. Yeni ekip i\u00E7in \u00F6nce temizleyin.",
            "Split-pane modu i\u00E7in tmux veya iTerm2 gerekir.",
            "Teammate\u2019ler lead\u2019in conversation history\u2019sini devralmaz; spawn prompt\u2019u yeterli context i\u00E7ermeli."
        ].map(t => new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: t, font: "Arial", size: 20, color: DARK })]
        })),

      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/sessions/funny-keen-galileo/mnt/FitTrack/FitTrack-Agent-Teams-Kilavuzu.docx", buffer);
  console.log("Document created successfully!");
});
