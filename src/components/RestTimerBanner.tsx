import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Vibration } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { colors, spacing, borderRadius } from '../theme/theme';
import { useLanguage } from '../i18n';

interface RestTimerBannerProps {
  durationSeconds?: number;
  onDone: () => void;
  onSkip: () => void;
}

export function RestTimerBanner({ durationSeconds = 90, onDone, onSkip }: RestTimerBannerProps) {
  const { t } = useLanguage();
  const [remaining, setRemaining] = useState(durationSeconds);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: durationSeconds * 1000,
      useNativeDriver: false,
    }).start();

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      progressAnim.stopAnimation();
    };
  }, [durationSeconds]);

  // Trigger onDone when countdown reaches 0 (safe — not inside state updater)
  useEffect(() => {
    if (remaining === 0) {
      Vibration.vibrate([0, 300, 100, 300]);
      onDoneRef.current();
    }
  }, [remaining]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
      <View style={styles.content}>
        <Text style={styles.label}>{t.workout.restTimer}</Text>
        <Text style={styles.timer}>{formatTime(remaining)}</Text>
        <Button
          mode="text"
          compact
          textColor="#fff"
          onPress={() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            progressAnim.stopAnimation();
            onSkip();
          }}
          labelStyle={styles.skipLabel}
        >
          {t.workout.skipRest}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  label: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    flex: 1,
  },
  timer: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  skipLabel: {
    fontSize: 12,
    color: '#fff',
  },
});
