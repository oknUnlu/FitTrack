import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Circle,
  Path,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 64 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#2E7D32" stopOpacity={1} />
          <Stop offset="50%" stopColor="#43A047" stopOpacity={1} />
          <Stop offset="100%" stopColor="#66BB6A" stopOpacity={1} />
        </LinearGradient>
        <LinearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#A5D6A7" stopOpacity={0.6} />
          <Stop offset="100%" stopColor="#E8F5E9" stopOpacity={0.3} />
        </LinearGradient>
      </Defs>

      {/* Background rounded square */}
      <Rect x="0" y="0" width="1024" height="1024" rx="220" ry="220" fill="url(#bgGrad)" />

      {/* Decorative circles */}
      <Circle cx="780" cy="240" r="180" fill="url(#accentGrad)" opacity={0.4} />
      <Circle cx="240" cy="780" r="140" fill="url(#accentGrad)" opacity={0.3} />

      {/* Shield shape */}
      <Path
        d="M512 160 C512 160, 720 200, 760 220 C760 220, 780 440, 760 560 C740 680, 620 800, 512 864 C404 800, 284 680, 264 560 C244 440, 264 220, 264 220 C304 200, 512 160, 512 160Z"
        fill="white"
        opacity={0.15}
      />

      {/* Heartbeat line */}
      <Polyline
        points="200,530 340,530 380,530 420,440 460,620 500,380 540,660 580,470 620,530 660,530 824,530"
        fill="none"
        stroke="white"
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.95}
      />

      {/* Dumbbell - left weight */}
      <Rect x="420" y="260" width="36" height="80" rx="8" fill="white" opacity={0.95} />
      <Rect x="434" y="240" width="8" height="120" rx="4" fill="white" opacity={0.95} />
      {/* Dumbbell - bar */}
      <Rect x="456" y="293" width="112" height="14" rx="7" fill="white" opacity={0.95} />
      {/* Dumbbell - right weight */}
      <Rect x="568" y="260" width="36" height="80" rx="8" fill="white" opacity={0.95} />
      <Rect x="582" y="240" width="8" height="120" rx="4" fill="white" opacity={0.95} />

      {/* "FT" Text */}
      <SvgText
        x="512"
        y="780"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="160"
        fontWeight="900"
        fill="white"
        opacity={0.95}
        letterSpacing={12}
      >
        FT
      </SvgText>

      {/* Accent underline */}
      <Rect x="412" y="800" width="200" height="6" rx="3" fill="#A5D6A7" opacity={0.8} />
    </Svg>
  );
}
