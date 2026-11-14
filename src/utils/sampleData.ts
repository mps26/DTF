import { ArtworkAsset } from '../types';
import { calculateEffectiveDpi, getDpiStatus, unitToMm } from './units';

// High-fidelity SVG generators for the 4 reference designs from the screenshots
function createDtfLogoSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="2048" viewBox="0 0 1152 2048">
    <rect width="1152" height="2048" fill="none"/>
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3b82f6"/>
        <stop offset="50%" stop-color="#8b5cf6"/>
        <stop offset="100%" stop-color="#ec4899"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.4"/>
      </filter>
    </defs>
    <!-- DTF Car Graphic -->
    <g transform="translate(150, 400)">
      <rect x="50" y="50" width="750" height="1100" rx="30" fill="#1e1e24" filter="url(#shadow)"/>
      <path d="M 150 700 L 250 500 L 600 500 L 700 700 L 720 900 L 130 900 Z" fill="url(#g1)"/>
      <circle cx="260" cy="900" r="80" fill="#111" stroke="#fff" stroke-width="8"/>
      <circle cx="590" cy="900" r="80" fill="#111" stroke="#fff" stroke-width="8"/>
      <text x="425" y="320" font-family="Arial Black, Impact, sans-serif" font-size="78" fill="#ffffff" text-anchor="middle" letter-spacing="8">PORSCHE</text>
      <text x="425" y="420" font-family="Arial Black, Impact, sans-serif" font-size="52" fill="#94a3b8" text-anchor="middle" letter-spacing="4">GT3 RS TRACK SPEC</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createMoneyPrayerSvg(): string {
  // Has empty transparent space around it (53% empty space) to demonstrate the auto-trim feature!
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="736" height="1472" viewBox="0 0 736 1472">
    <rect width="736" height="1472" fill="none"/>
    <!-- Centered design with intentional empty borders around it -->
    <g transform="translate(140, 290)">
      <rect x="0" y="0" width="456" height="892" rx="12" fill="#090a0f"/>
      <text x="228" y="240" font-family="Impact, Arial Black, sans-serif" font-size="110" fill="#ffffff" text-anchor="middle" letter-spacing="6">MONEY</text>
      <text x="228" y="420" font-family="Impact, Arial Black, sans-serif" font-size="110" fill="#ffffff" text-anchor="middle" letter-spacing="6">PRAYER</text>
      <text x="228" y="600" font-family="Impact, Arial Black, sans-serif" font-size="110" fill="#ffffff" text-anchor="middle" letter-spacing="6">HUSTLE</text>
      <rect x="60" y="660" width="336" height="6" fill="#e2e8f0"/>
      <text x="228" y="760" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="3">NEVER SLEEP 24/7</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createDreamsSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="736" height="1104" viewBox="0 0 736 1104">
    <rect width="736" height="1104" fill="none"/>
    <g transform="translate(68, 80)">
      <rect x="0" y="0" width="600" height="944" fill="#000000" rx="20"/>
      <text x="300" y="220" font-family="Impact, sans-serif" font-size="95" fill="#f8fafc" text-anchor="middle">DREAMS</text>
      <text x="300" y="360" font-family="Impact, sans-serif" font-size="80" fill="#cbd5e1" text-anchor="middle">BECOME</text>
      <text x="300" y="520" font-family="Impact, sans-serif" font-size="95" fill="#ffffff" text-anchor="middle">REALITY</text>
      <text x="300" y="680" font-family="Arial Black, sans-serif" font-size="48" fill="#fbbf24" text-anchor="middle">ONLY WHEN ACTION</text>
      <text x="300" y="780" font-family="Impact, sans-serif" font-size="70" fill="#f43f5e" text-anchor="middle">BECOMES A HABIT</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createPorsche911Svg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="736" height="1104" viewBox="0 0 736 1104">
    <rect width="736" height="1104" fill="none"/>
    <g transform="translate(68, 80)">
      <rect x="0" y="0" width="600" height="944" fill="#18181b" rx="20"/>
      <text x="300" y="260" font-family="Arial Black, sans-serif" font-size="72" fill="#e4e4e7" text-anchor="middle">911 PRO</text>
      <!-- Stylized rear car silhouette -->
      <path d="M 100 650 Q 300 480 500 650 L 520 800 L 80 800 Z" fill="#ef4444"/>
      <rect x="120" y="660" width="360" height="16" fill="#f87171" rx="4"/>
      <text x="300" y="870" font-family="Courier New, monospace" font-size="34" font-weight="bold" fill="#71717a" text-anchor="middle">EDITION 01 / 99</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createOmLogoSvg(): string {
  // Reference from Screen 1: om.png, 1254 x 1254 px
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
    <rect width="1254" height="1254" fill="none"/>
    <circle cx="627" cy="627" r="540" fill="none" stroke="#6366f1" stroke-width="36"/>
    <circle cx="627" cy="627" r="480" fill="none" stroke="#ec4899" stroke-width="12" stroke-dasharray="24 16"/>
    <g transform="translate(627, 627) scale(2.4)">
      <!-- OM Symbol representation -->
      <path d="M-60,-20 C-60,-80 20,-100 50,-50 C70,-20 40,20 -10,30 C30,40 60,80 30,120 C0,150 -80,120 -80,60" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round"/>
      <path d="M40,-30 C70,-30 100,0 80,40" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
      <circle cx="70" cy="-70" r="14" fill="#fbbf24"/>
      <path d="M30,-90 Q70,-70 110,-90" fill="none" stroke="#fbbf24" stroke-width="12" stroke-linecap="round"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getSampleArtworkAssets(): ArtworkAsset[] {
  const dtfUrl = createDtfLogoSvg();
  const moneyUrl = createMoneyPrayerSvg();
  const dreamsUrl = createDreamsSvg();
  const porscheUrl = createPorsche911Svg();

  const dtfWIn = 3.84;
  const dtfHIn = 6.83;
  const dtfWMm = unitToMm(dtfWIn, 'inch');
  const dtfHMm = unitToMm(dtfHIn, 'inch');

  const moneyWIn = 2.45;
  const moneyHIn = 4.91;
  const moneyWMm = unitToMm(moneyWIn, 'inch');
  const moneyHMm = unitToMm(moneyHIn, 'inch');

  const dreamsWIn = 2.45;
  const dreamsHIn = 3.68;
  const dreamsWMm = unitToMm(dreamsWIn, 'inch');
  const dreamsHMm = unitToMm(dreamsHIn, 'inch');

  const porscheWIn = 2.45;
  const porscheHIn = 3.68;
  const porscheWMm = unitToMm(porscheWIn, 'inch');
  const porscheHMm = unitToMm(porscheHIn, 'inch');

  return [
    {
      id: 'asset-1',
      filename: 'dtf.png',
      fileType: 'png',
      fileSize: 1024 * 340,
      originalWidth: 1152,
      originalHeight: 2048,
      originalAspectRatio: 1152 / 2048,
      hasAlpha: true,
      originalUrl: dtfUrl,
      processedUrl: dtfUrl,
      trimmedWidth: 1152,
      trimmedHeight: 2048,
      cropBox: null,
      isTrimmed: false,
      isBgRemoved: false,
      targetWidth: dtfWIn,
      targetHeight: dtfHIn,
      targetWidthMm: dtfWMm,
      targetHeightMm: dtfHMm,
      aspectLocked: true,
      copies: 1,
      allowRotation: false,
      effectiveDpi: calculateEffectiveDpi(1152, dtfWMm),
      dpiStatus: getDpiStatus(calculateEffectiveDpi(1152, dtfWMm)),
      status: 'ready'
    },
    {
      id: 'asset-2',
      filename: 'Money prayer.jpeg',
      fileType: 'jpeg',
      fileSize: 1024 * 180,
      originalWidth: 736,
      originalHeight: 1472,
      originalAspectRatio: 736 / 1472,
      hasAlpha: true,
      originalUrl: moneyUrl,
      processedUrl: moneyUrl,
      trimmedWidth: 456,
      trimmedHeight: 892,
      cropBox: {
        minX: 140,
        minY: 290,
        maxX: 596,
        maxY: 1182,
        width: 456,
        height: 892,
        emptyPercent: 53
      },
      isTrimmed: false,
      isBgRemoved: true,
      targetWidth: moneyWIn,
      targetHeight: moneyHIn,
      targetWidthMm: moneyWMm,
      targetHeightMm: moneyHMm,
      aspectLocked: true,
      copies: 1,
      allowRotation: false,
      effectiveDpi: calculateEffectiveDpi(736, moneyWMm),
      dpiStatus: getDpiStatus(calculateEffectiveDpi(736, moneyWMm)),
      status: 'warning',
      warningMessage: '53% of this is empty space'
    },
    {
      id: 'asset-3',
      filename: 'Dreams to Reality.jpeg',
      fileType: 'jpeg',
      fileSize: 1024 * 220,
      originalWidth: 736,
      originalHeight: 1104,
      originalAspectRatio: 736 / 1104,
      hasAlpha: true,
      originalUrl: dreamsUrl,
      processedUrl: dreamsUrl,
      trimmedWidth: 736,
      trimmedHeight: 1104,
      cropBox: null,
      isTrimmed: false,
      isBgRemoved: true,
      targetWidth: dreamsWIn,
      targetHeight: dreamsHIn,
      targetWidthMm: dreamsWMm,
      targetHeightMm: dreamsHMm,
      aspectLocked: true,
      copies: 1,
      allowRotation: false,
      effectiveDpi: calculateEffectiveDpi(736, dreamsWMm),
      dpiStatus: getDpiStatus(calculateEffectiveDpi(736, dreamsWMm)),
      status: 'ready'
    },
    {
      id: 'asset-4',
      filename: '911 pro ..jpeg',
      fileType: 'jpeg',
      fileSize: 1024 * 210,
      originalWidth: 736,
      originalHeight: 1104,
      originalAspectRatio: 736 / 1104,
      hasAlpha: true,
      originalUrl: porscheUrl,
      processedUrl: porscheUrl,
      trimmedWidth: 736,
      trimmedHeight: 1104,
      cropBox: null,
      isTrimmed: false,
      isBgRemoved: true,
      targetWidth: porscheWIn,
      targetHeight: porscheHIn,
      targetWidthMm: porscheWMm,
      targetHeightMm: porscheHMm,
      aspectLocked: true,
      copies: 1,
      allowRotation: false,
      effectiveDpi: calculateEffectiveDpi(736, porscheWMm),
      dpiStatus: getDpiStatus(calculateEffectiveDpi(736, porscheWMm)),
      status: 'ready'
    }
  ];
}

export function getSampleOmAsset(): ArtworkAsset {
  const omUrl = createOmLogoSvg();
  const omWIn = 2.18;
  const omHIn = 2.18;
  const omWMm = unitToMm(omWIn, 'inch');
  const omHMm = unitToMm(omHIn, 'inch');

  return {
    id: 'asset-om',
    filename: 'om.png',
    fileType: 'png',
    fileSize: 1024 * 420,
    originalWidth: 1254,
    originalHeight: 1254,
    originalAspectRatio: 1254 / 1254,
    hasAlpha: true,
    originalUrl: omUrl,
    processedUrl: omUrl,
    trimmedWidth: 1254,
    trimmedHeight: 1254,
    cropBox: null,
    isTrimmed: false,
    isBgRemoved: false,
    targetWidth: omWIn,
    targetHeight: omHIn,
    targetWidthMm: omWMm,
    targetHeightMm: omHMm,
    aspectLocked: true,
    copies: 10,
    allowRotation: false,
    effectiveDpi: 575,
    dpiStatus: 'green',
    status: 'ready'
  };
}

