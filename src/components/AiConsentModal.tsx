import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../i18n';
import { useConsentStore } from '../store/consentStore';
import { useAiConsentStore } from '../services/privacy/aiConsent';
import { colors, spacing, borderRadius } from '../theme/theme';

// Same hosted KVKK notice used on the onboarding welcome screen.
const KVKK_URL = 'https://fittrack-a958c.web.app/kvkk';

export function AiConsentModal() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const visible = useAiConsentStore((s) => s.visible);
  const settle = useAiConsentStore((s) => s.settle);
  const setConsent = useConsentStore((s) => s.setConsent);

  const L = (t as any)?.aiConsent;
  const title = L?.title || 'Separate consent for AI features';
  const body =
    L?.body ||
    'The AI Coach, food recognition and plan generation features send your messages, photos and, in some features, profile details to Google Gemini (USA) for processing. This data may include health information. Under the free API, Google may use it to improve its models. If you decline, these features will not be used and no data is sent; the rest of the app keeps working. You can withdraw your consent anytime in Profile.';
  const accept = L?.accept || 'I give my explicit consent';
  const decline = L?.decline || 'Not now';
  const privacyLink = L?.privacyLink || 'KVKK / GDPR Notice';

  const handleAccept = async () => {
    await setConsent('aiDataSharing', true);
    settle(true);
  };

  const handleDecline = () => {
    settle(false);
  };

  const openKvkk = async () => {
    try {
      await Linking.openURL(KVKK_URL);
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDecline}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.body}>{body}</Text>
            <TouchableOpacity onPress={openKvkk} hitSlop={8}>
              <Text style={styles.link}>{privacyLink}</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.actions}>
            <Button mode="text" onPress={handleDecline}>
              {decline}
            </Button>
            <Button mode="contained" onPress={handleAccept}>
              {accept}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  bodyScroll: {
    maxHeight: 360,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  link: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
