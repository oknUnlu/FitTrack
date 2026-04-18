import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { useLanguage } from '../../i18n';
import { useConsentStore, ConsentKey, MIN_APP_AGE } from '../../store/consentStore';

/**
 * ConsentScreen — first-run KVKK/GDPR open consent flow.
 *
 * Required (blocks app use):
 *   - privacyPolicy
 *   - termsOfService
 *   - kvkk
 *   - medicalDisclaimerAcknowledged
 *
 * Optional (granular toggles):
 *   - aiDataSharing      (Gemini / international transfer)
 *   - healthData         (HealthKit / Health Connect)
 *   - analytics
 *   - crashReports
 *   - marketing
 *   - personalizedAds
 *
 * Also collects an age attestation so we can block <13 from the app entirely
 * and hide adult-only features (fasting, supplements) for <18.
 */

const PRIVACY_URL = 'https://fittrack-a958c.web.app/privacy';
const TERMS_URL = 'https://fittrack-a958c.web.app/terms';
const KVKK_URL = 'https://fittrack-a958c.web.app/kvkk';

interface ConsentScreenProps {
  onAccept: () => void;
}

export function ConsentScreen({ onAccept }: ConsentScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const setConsents = useConsentStore((s) => s.setConsents);
  const setAge = useConsentStore((s) => s.setAge);

  const L = (t as any)?.legal?.consent || {};

  const [age, setAgeState] = useState<string>('');
  const [required, setRequired] = useState<Record<ConsentKey, boolean>>({
    privacyPolicy: false,
    termsOfService: false,
    kvkk: false,
    medicalDisclaimerAcknowledged: false,
    aiDataSharing: false,
    healthData: false,
    analytics: false,
    crashReports: false,
    marketing: false,
    personalizedAds: false,
  });

  const toggle = (key: ConsentKey) =>
    setRequired((prev) => ({ ...prev, [key]: !prev[key] }));

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Hata', 'Bağlantı açılamadı.');
    }
  };

  const handleAccept = async () => {
    const parsedAge = parseInt(age, 10);
    if (!age || isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      Alert.alert('', L.ageInvalid || 'Lütfen geçerli bir yaş girin.');
      return;
    }
    if (parsedAge < MIN_APP_AGE) {
      Alert.alert(
        L.ageTooYoungTitle || 'Yaş Sınırı',
        L.ageTooYoung ||
          'Bu uygulama 13 yaşın altındaki çocukların kullanımına uygun değildir. Lütfen bir ebeveyn veya yasal vasiye danışın.',
      );
      return;
    }
    if (
      !required.privacyPolicy ||
      !required.termsOfService ||
      !required.kvkk ||
      !required.medicalDisclaimerAcknowledged
    ) {
      Alert.alert(
        '',
        L.requiredMissing ||
          'Uygulamayı kullanabilmek için zorunlu alanları onaylamalısınız.',
      );
      return;
    }

    await setAge(parsedAge);
    await setConsents(required);
    onAccept();
  };

  const ConsentRow = ({
    k,
    label,
    description,
    required: req,
    link,
  }: {
    k: ConsentKey;
    label: string;
    description?: string;
    required?: boolean;
    link?: string;
  }) => (
    <View style={[styles.row, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.rowText}>
        <View style={styles.rowLabelLine}>
          <Text style={[styles.rowLabel, { color: theme.colors.onSurface }]}>
            {label}
            {req && <Text style={{ color: colors.red }}> *</Text>}
          </Text>
          {link && (
            <TouchableOpacity onPress={() => openUrl(link)} hitSlop={8}>
              <MaterialCommunityIcons name="open-in-new" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        {description && (
          <Text style={styles.rowDesc}>{description}</Text>
        )}
      </View>
      <Switch
        value={required[k]}
        onValueChange={() => toggle(k)}
        trackColor={{ false: '#ccc', true: colors.primary }}
      />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="shield-check" size={40} color={colors.primary} />
          <Text style={styles.title}>{L.title || 'Gizlilik ve Açık Rıza'}</Text>
          <Text style={styles.subtitle}>
            {L.subtitle ||
              'Kişisel verileriniz KVKK ve GDPR kapsamında korunur. Hangi verilerin nasıl işleneceğini aşağıdan seçebilirsiniz.'}
          </Text>
        </View>

        {/* Age gate */}
        <View style={[styles.ageBox, { backgroundColor: theme.colors.surface }]}>
          <Text style={styles.sectionTitle}>{L.ageTitle || 'Yaş Beyanı'}</Text>
          <Text style={styles.rowDesc}>
            {L.ageDescription ||
              'Uygulama 13 yaşın altındaki çocuklar için uygun değildir. Bazı özellikler 18 yaş üstü için sınırlandırılmıştır.'}
          </Text>
          <View style={styles.ageInputRow}>
            <Text style={styles.ageLabel}>{L.ageLabel || 'Yaşınız'}:</Text>
            <View style={styles.ageInputBox}>
              <Text
                style={styles.ageValue}
                onPress={() => {
                  // minimal placeholder, real form handles via TextInput upstream
                }}
              >
                {age || '—'}
              </Text>
            </View>
          </View>
          <AgeStepper value={age} onChange={setAgeState} />
        </View>

        <Text style={styles.sectionTitle}>{L.requiredSection || 'Zorunlu (*)'}</Text>
        <ConsentRow
          k="privacyPolicy"
          label={L.privacyPolicy || 'Gizlilik Politikasını okudum ve kabul ediyorum'}
          required
          link={PRIVACY_URL}
        />
        <ConsentRow
          k="termsOfService"
          label={L.tos || 'Kullanım Şartlarını okudum ve kabul ediyorum'}
          required
          link={TERMS_URL}
        />
        <ConsentRow
          k="kvkk"
          label={L.kvkk || 'KVKK Aydınlatma Metnini okudum, kişisel verilerimin işlenmesine açık rıza gösteriyorum'}
          required
          link={KVKK_URL}
        />
        <ConsentRow
          k="medicalDisclaimerAcknowledged"
          label={L.medical || 'Bu uygulamanın tıbbi tavsiye yerine geçmediğini anladım'}
          description={L.medicalDesc || 'Sağlık kararlarınız için hekime/diyetisyene danışın. Uygulama yalnızca genel bilgilendirme amaçlıdır.'}
          required
        />

        <Text style={styles.sectionTitle}>{L.optionalSection || 'İsteğe Bağlı'}</Text>
        <ConsentRow
          k="aiDataSharing"
          label={L.ai || 'AI Koç: sorularım ve fotoğraflarım Google Gemini\'ye gönderilsin'}
          description={L.aiDesc || 'AI Koç ve kalori tanıma için gönderiniz AB dışına (Google) aktarılır. Onay vermezseniz bu özellikler devre dışı kalır.'}
        />
        <ConsentRow
          k="healthData"
          label={Platform.OS === 'ios' ? (L.healthIos || 'Apple HealthKit ile sağlık verilerim okunsun') : (L.healthAndroid || 'Android Health Connect ile sağlık verilerim okunsun')}
          description={L.healthDesc || 'Adım, kalp atışı, uyku ve kalori verileri yalnızca cihazınızda işlenir, sunucuya gönderilmez.'}
        />
        <ConsentRow
          k="analytics"
          label={L.analytics || 'Anonim kullanım analitikleri'}
        />
        <ConsentRow
          k="crashReports"
          label={L.crash || 'Çökme raporları'}
        />
        <ConsentRow
          k="marketing"
          label={L.marketing || 'E-posta/bildirim ile tanıtım içeriği almak istiyorum'}
        />
        <ConsentRow
          k="personalizedAds"
          label={L.ads || 'Kişiselleştirilmiş reklamları kabul ediyorum'}
          description={L.adsDesc || 'Reklamlar AdMob aracılığıyla gösterilir. Kapalı olduğunda genel (kişiselleştirilmemiş) reklam görürsünüz.'}
        />

        <Text style={styles.footerNote}>
          {L.footer ||
            'Bu tercihleri istediğiniz zaman Ayarlar > Gizlilik menüsünden değiştirebilir, hesabınızı silebilir veya verilerinizi dışa aktarabilirsiniz.'}
        </Text>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + spacing.md, backgroundColor: theme.colors.surface },
        ]}
      >
        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
          <Text style={styles.acceptText}>{L.accept || 'Onayla ve Devam Et'}</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AgeStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = parseInt(value, 10);
  const current = isNaN(n) ? 25 : n;
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity
        style={styles.stepperBtn}
        onPress={() => onChange(String(Math.max(1, current - 1)))}
      >
        <MaterialCommunityIcons name="minus" size={20} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{current}</Text>
      <TouchableOpacity
        style={styles.stepperBtn}
        onPress={() => onChange(String(Math.min(120, current + 1)))}
      >
        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: 'bold', marginTop: 8, textAlign: 'center' },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    color: colors.textSecondary,
  },
  ageBox: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  ageInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  ageLabel: { fontSize: 14, fontWeight: '600', marginRight: 10 },
  ageInputBox: {
    minWidth: 60,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    backgroundColor: '#F0F0F0',
  },
  ageValue: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 10 },
  stepperBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperValue: { fontSize: 22, fontWeight: '700', minWidth: 50, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: 8,
  },
  rowText: { flex: 1, marginRight: 10 },
  rowLabelLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 16 },
  footerNote: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: spacing.lg,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    gap: 8,
  },
  acceptText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
