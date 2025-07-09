import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Required icons based on manifest.json
const requiredIcons = [
  'icon-72x72.png',
  'icon-96x96.png',
  'icon-128x128.png',
  'icon-144x144.png',
  'icon-152x152.png',
  'icon-192x192.png',
  'icon-384x384.png',
  'icon-512x512.png',
  'apple-touch-icon.png',
  'favicon-16x16.png',
  'favicon-32x32.png'
];

console.log('🔍 Verifying TradeWorks Pro App Icons');
console.log('=====================================\n');

const iconsDir = path.join(__dirname, '../public/icons');
let allIconsPresent = true;

// Check if icons directory exists
if (!fs.existsSync(iconsDir)) {
  console.error('❌ Icons directory not found at:', iconsDir);
  process.exit(1);
}

// Check each required icon
console.log('Checking required icons:\n');
for (const icon of requiredIcons) {
  const iconPath = path.join(iconsDir, icon);
  if (fs.existsSync(iconPath)) {
    const stats = fs.statSync(iconPath);
    console.log(`✅ ${icon} (${stats.size} bytes)`);
  } else {
    console.log(`❌ ${icon} - MISSING`);
    allIconsPresent = false;
  }
}

// List any extra icons found
console.log('\n📁 All files in icons directory:\n');
const allFiles = fs.readdirSync(iconsDir);
allFiles.forEach(file => {
  if (!requiredIcons.includes(file) && file !== 'icon-config.json') {
    console.log(`  📄 ${file} (extra)`);
  }
});

// Summary
console.log('\n=====================================');
if (allIconsPresent) {
  console.log('✨ All required icons are present!');
  console.log('\n🚀 Your mobile app icons are ready!');
  console.log('\nNext steps:');
  console.log('1. Test PWA installation on a mobile device');
  console.log('2. Run the app and check DevTools > Application > Manifest');
  console.log('3. For native apps, copy icons to platform-specific folders');
} else {
  console.log('⚠️  Some required icons are missing!');
  console.log('\nPlease ensure all icons listed above are present.');
}