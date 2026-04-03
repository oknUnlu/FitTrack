import React, { useRef, useCallback } from 'react';
import { View, StyleSheet, Share, Platform } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useLanguage } from '../i18n';

interface ShareCardProps {
  type: 'workout' | 'achievement' | 'streak' | 'challenge';
  title: string;
  subtitle: string;
  value: string;
  icon: string;
  color: string;
  onShare?: () => void;
}

/**
 * Shareable card component that can be captured as an image
 * and shared to social media (Instagram Stories, TikTok, etc.)
 */
export function ShareCard({ type, title, subtitle, value, icon, color, onShare }: ShareCardProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const { t } = useLanguage();

  const shareMessage = `${title}: ${value} - ${subtitle}\n\nFitTrack ile takip ediyorum!`;

  const handleShare = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        await Share.share({ message: shareMessage });
        onShare?.();
        return;
      }

      // Native: capture card as image and share
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Share.share(
          Platform.OS === 'ios'
            ? { url: uri, message: shareMessage }
            : { message: shareMessage }
        );
      } else {
        await Share.share({ message: shareMessage });
      }

      onShare?.();
    } catch (e) {
      if (__DEV__) console.warn('Share failed:', e);
    }
  }, [title, value, subtitle, onShare, shareMessage]);

  const bgGradientStart = `${color}15`;

  return (
    <View>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
        <View style={[styles.card, { backgroundColor: bgGradientStart, borderColor: `${color}30` }]}>
          {/* FitTrack branding */}
          <View style={styles.brandRow}>
            <View style={[styles.brandDot, { backgroundColor: color }]} />
            <Text style={[styles.brandText, { color }]}>FitTrack</Text>
          </View>

          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
            <MaterialCommunityIcons name={icon as any} size={36} color={color} />
          </View>

          {/* Content */}
          <Text style={[styles.value, { color }]}>{value}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>fittrack.app</Text>
          </View>
        </View>
      </ViewShot>

      <Button
        mode="contained"
        icon="share-variant"
        onPress={handleShare}
        style={[styles.shareBtn, { backgroundColor: color }]}
        compact
        accessibilityLabel={`Share ${title}`}
        accessibilityRole="button"
      >
        {t.social.share}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brandText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    width: '100%',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#bbb',
    letterSpacing: 0.5,
  },
  shareBtn: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
  },
});
