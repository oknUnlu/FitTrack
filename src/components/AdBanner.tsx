import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { usePremiumStore } from '../store/premiumStore';
import { getBannerAdUnitId, type BannerScreen } from '../services/ads/adService';
import { getSemanticColors } from '../theme/theme';

// Native modül mevcut mu kontrol et (Expo Go'da mevcut değildir)
let AdComponents: { BannerAd: any; BannerAdSize: any } | null = null;
try {
  const mod = require('react-native-google-mobile-ads');
  // Modül yüklendi ama native binary'de kayıtlı mı kontrol et
  if (mod?.BannerAd && mod?.BannerAdSize) {
    AdComponents = { BannerAd: mod.BannerAd, BannerAdSize: mod.BannerAdSize };
  }
} catch {
  AdComponents = null;
}

interface AdBannerProps {
  screen: BannerScreen;
}

/**
 * Banner reklam bileşeni.
 * Premium kullanıcılar için otomatik olarak gizlenir.
 * Native modül yoksa (Expo Go) sessizce hiçbir şey render etmez.
 */
export function AdBanner({ screen }: AdBannerProps) {
  const isPremium = usePremiumStore((s) => s.isPremium);
  const theme = useTheme();
  const isDark = theme.dark;
  const sc = getSemanticColors(isDark);
  const [adError, setAdError] = useState(false);

  // SDK mevcut değilse, premium ise veya web ise gösterme
  if (!AdComponents || isPremium || Platform.OS === 'web' || adError) return null;

  const { BannerAd, BannerAdSize } = AdComponents;
  const adUnitId = getBannerAdUnitId(screen);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? sc.surface : '#FAFAFA' }]}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={() => setAdError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginTop: 8,
  },
});
