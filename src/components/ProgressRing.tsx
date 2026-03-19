import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface ProgressRingProps {
  size: number;
  strokeWidth: number;
  progress: number; // 0-1
  color: string;
  bgColor?: string;
  centerLabel?: string;
  centerSubLabel?: string;
}

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  bgColor = '#E0E0E0',
  centerLabel,
  centerSubLabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - Math.min(progress, 1) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {centerLabel && (
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.centerLabel, { color }]}>{centerLabel}</Text>
          {centerSubLabel && <Text style={styles.centerSubLabel}>{centerSubLabel}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerLabel: { fontSize: 28, fontWeight: 'bold' },
  centerSubLabel: { fontSize: 12, color: '#999', marginTop: 2 },
});
