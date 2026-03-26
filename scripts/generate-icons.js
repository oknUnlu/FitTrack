const sharp = require('sharp');
const path = require('path');

// SVG matching the Logo.tsx design (heart + pulse + dumbbell, no "FT" text)
const createSvg = (size, { includeBackground = true, padding = 0 } = {}) => {
  const viewBox = includeBackground ? '0 0 1024 1024' : `${padding} ${padding} ${1024 - padding * 2} ${1024 - padding * 2}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B5E20" stop-opacity="1" />
      <stop offset="50%" stop-color="#2E7D32" stop-opacity="1" />
      <stop offset="100%" stop-color="#43A047" stop-opacity="1" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#A5D6A7" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#66BB6A" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1" />
      <stop offset="100%" stop-color="#E8F5E9" stop-opacity="0.9" />
    </linearGradient>
  </defs>

  <!-- Background rounded square -->
  <rect x="0" y="0" width="1024" height="1024" rx="230" ry="230" fill="url(#bgGrad)" />

  <!-- Subtle glow at top -->
  <circle cx="512" cy="280" r="300" fill="url(#glowGrad)" opacity="0.3" />

  <!-- Decorative ring -->
  <circle cx="512" cy="460" r="320" fill="none" stroke="white" stroke-width="3" opacity="0.1" />
  <circle cx="512" cy="460" r="260" fill="none" stroke="white" stroke-width="2" opacity="0.07" />

  <!-- Heart shape - centered -->
  <g opacity="0.95">
    <path
      d="M512 700 C512 700, 280 540, 280 390 C280 290, 360 220, 440 220 C490 220, 512 260, 512 260 C512 260, 534 220, 584 220 C664 220, 744 290, 744 390 C744 540, 512 700, 512 700Z"
      fill="url(#heartGrad)"
    />
  </g>

  <!-- Heartbeat/pulse line across the heart -->
  <polyline
    points="320,430 410,430 440,430 468,360 496,500 524,320 552,520 580,380 608,430 640,430 710,430"
    fill="none"
    stroke="#2E7D32"
    stroke-width="24"
    stroke-linecap="round"
    stroke-linejoin="round"
    opacity="0.85"
  />

  <!-- Dumbbell below heart -->
  <g opacity="0.95">
    <!-- Left plate -->
    <rect x="340" y="760" width="50" height="80" rx="10" fill="white" />
    <rect x="370" y="745" width="14" height="110" rx="7" fill="white" />
    <!-- Bar -->
    <rect x="384" y="792" width="256" height="16" rx="8" fill="white" />
    <!-- Right plate -->
    <rect x="634" y="760" width="50" height="80" rx="10" fill="white" />
    <rect x="640" y="745" width="14" height="110" rx="7" fill="white" />
  </g>

  <!-- Small accent dots -->
  <circle cx="200" cy="200" r="8" fill="white" opacity="0.2" />
  <circle cx="824" cy="200" r="6" fill="white" opacity="0.15" />
  <circle cx="180" cy="820" r="5" fill="white" opacity="0.12" />
  <circle cx="844" cy="824" r="7" fill="white" opacity="0.18" />
</svg>`;
};

// Splash icon: just the heart+pulse+dumbbell centered on transparent/green background
const createSplashSvg = (size) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="heartGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1" />
      <stop offset="100%" stop-color="#E8F5E9" stop-opacity="0.9" />
    </linearGradient>
  </defs>

  <!-- Heart shape - centered -->
  <g opacity="0.95">
    <path
      d="M512 700 C512 700, 280 540, 280 390 C280 290, 360 220, 440 220 C490 220, 512 260, 512 260 C512 260, 534 220, 584 220 C664 220, 744 290, 744 390 C744 540, 512 700, 512 700Z"
      fill="url(#heartGrad2)"
    />
  </g>

  <!-- Heartbeat/pulse line -->
  <polyline
    points="320,430 410,430 440,430 468,360 496,500 524,320 552,520 580,380 608,430 640,430 710,430"
    fill="none"
    stroke="#2E7D32"
    stroke-width="24"
    stroke-linecap="round"
    stroke-linejoin="round"
    opacity="0.85"
  />

  <!-- Dumbbell below heart -->
  <g opacity="0.95">
    <rect x="340" y="760" width="50" height="80" rx="10" fill="white" />
    <rect x="370" y="745" width="14" height="110" rx="7" fill="white" />
    <rect x="384" y="792" width="256" height="16" rx="8" fill="white" />
    <rect x="634" y="760" width="50" height="80" rx="10" fill="white" />
    <rect x="640" y="745" width="14" height="110" rx="7" fill="white" />
  </g>
</svg>`;
};

async function generate() {
  const assetsDir = path.join(__dirname, '..', 'assets');

  // 1. icon.png - 1024x1024 (iOS app icon)
  await sharp(Buffer.from(createSvg(1024)))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('✓ icon.png (1024x1024)');

  // 2. adaptive-icon.png - 1024x1024 (Android adaptive icon foreground)
  await sharp(Buffer.from(createSvg(1024)))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png (1024x1024)');

  // 3. splash-icon.png - 512x512 (splash screen icon on green bg)
  await sharp(Buffer.from(createSplashSvg(512)))
    .resize(512, 512)
    .png()
    .toFile(path.join(assetsDir, 'splash-icon.png'));
  console.log('✓ splash-icon.png (512x512)');

  // 4. favicon.png - 48x48 (web favicon)
  await sharp(Buffer.from(createSvg(48)))
    .resize(48, 48)
    .png()
    .toFile(path.join(assetsDir, 'favicon.png'));
  console.log('✓ favicon.png (48x48)');

  console.log('\nAll icons generated successfully!');
}

generate().catch(console.error);
