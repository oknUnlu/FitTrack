import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Circle,
  Path,
  Polyline,
  G,
} from 'react-native-svg';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 64 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#1B5E20" stopOpacity={1} />
          <Stop offset="50%" stopColor="#2E7D32" stopOpacity={1} />
          <Stop offset="100%" stopColor="#43A047" stopOpacity={1} />
        </LinearGradient>
        <LinearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#A5D6A7" stopOpacity={0.5} />
          <Stop offset="100%" stopColor="#66BB6A" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="100%" stopColor="#E8F5E9" stopOpacity={0.9} />
        </LinearGradient>
      </Defs>

      {/* Background rounded square */}
      <Rect x="0" y="0" width="1024" height="1024" rx="230" ry="230" fill="url(#bgGrad)" />

      {/* Subtle glow at top */}
      <Circle cx="512" cy="280" r="300" fill="url(#glowGrad)" opacity={0.3} />

      {/* Decorative ring */}
      <Circle cx="512" cy="460" r="320" fill="none" stroke="white" strokeWidth="3" opacity={0.1} />
      <Circle cx="512" cy="460" r="260" fill="none" stroke="white" strokeWidth="2" opacity={0.07} />

      {/* Heart shape - centered */}
      <G opacity={0.95}>
        <Path
          d="M512 700 C512 700, 280 540, 280 390 C280 290, 360 220, 440 220 C490 220, 512 260, 512 260 C512 260, 534 220, 584 220 C664 220, 744 290, 744 390 C744 540, 512 700, 512 700Z"
          fill="url(#heartGrad)"
        />
      </G>

      {/* Heartbeat/pulse line across the heart */}
      <Polyline
        points="320,430 410,430 440,430 468,360 496,500 524,320 552,520 580,380 608,430 640,430 710,430"
        fill="none"
        stroke="#2E7D32"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />

      {/* Dumbbell below heart */}
      <G opacity={0.95}>
        {/* Left plate */}
        <Rect x="340" y="760" width="50" height="80" rx="10" fill="white" />
        <Rect x="370" y="745" width="14" height="110" rx="7" fill="white" />
        {/* Bar */}
        <Rect x="384" y="792" width="256" height="16" rx="8" fill="white" />
        {/* Right plate */}
        <Rect x="634" y="760" width="50" height="80" rx="10" fill="white" />
        <Rect x="640" y="745" width="14" height="110" rx="7" fill="white" />
      </G>

      {/* Small accent dots */}
      <Circle cx="200" cy="200" r="8" fill="white" opacity={0.2} />
      <Circle cx="824" cy="200" r="6" fill="white" opacity={0.15} />
      <Circle cx="180" cy="820" r="5" fill="white" opacity={0.12} />
      <Circle cx="844" cy="824" r="7" fill="white" opacity={0.18} />
    </Svg>
  );
}
