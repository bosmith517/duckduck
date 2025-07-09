#!/usr/bin/env node

/**
 * Generate App Icons Script
 * 
 * This script generates all required app icons for iOS, Android, and PWA
 * from a source image.
 * 
 * Requirements:
 * - Node.js
 * - npm install sharp (for image processing)
 * 
 * Usage: node scripts/generate-app-icons.js
 */

const fs = require('fs');
const path = require('path');

// Icon size configurations
const iconSizes = {
  // PWA Icons
  pwa: [
    { size: 72, name: 'icon-72x72.png' },
    { size: 96, name: 'icon-96x96.png' },
    { size: 128, name: 'icon-128x128.png' },
    { size: 144, name: 'icon-144x144.png' },
    { size: 152, name: 'icon-152x152.png' },
    { size: 192, name: 'icon-192x192.png' },
    { size: 384, name: 'icon-384x384.png' },
    { size: 512, name: 'icon-512x512.png' }
  ],
  
  // iOS Icons
  ios: [
    { size: 20, name: 'icon-20.png' },
    { size: 29, name: 'icon-29.png' },
    { size: 40, name: 'icon-40.png' },
    { size: 60, name: 'icon-60.png' },
    { size: 76, name: 'icon-76.png' },
    { size: 83.5, name: 'icon-83.5.png' },
    { size: 120, name: 'icon-120.png' },
    { size: 152, name: 'icon-152.png' },
    { size: 167, name: 'icon-167.png' },
    { size: 180, name: 'icon-180.png' },
    { size: 1024, name: 'icon-1024.png' }
  ],
  
  // Android Icons
  android: [
    { size: 36, name: 'ldpi.png', folder: 'mipmap-ldpi' },
    { size: 48, name: 'mdpi.png', folder: 'mipmap-mdpi' },
    { size: 72, name: 'hdpi.png', folder: 'mipmap-hdpi' },
    { size: 96, name: 'xhdpi.png', folder: 'mipmap-xhdpi' },
    { size: 144, name: 'xxhdpi.png', folder: 'mipmap-xxhdpi' },
    { size: 192, name: 'xxxhdpi.png', folder: 'mipmap-xxxhdpi' }
  ],
  
  // Favicon sizes
  favicon: [
    { size: 16, name: 'favicon-16x16.png' },
    { size: 32, name: 'favicon-32x32.png' },
    { size: 48, name: 'favicon-48x48.png' }
  ],
  
  // Apple Touch Icons
  apple: [
    { size: 180, name: 'apple-touch-icon.png' }
  ]
};

async function generateIcons() {
  console.log('🎨 TradeWorks Pro Icon Generator');
  console.log('================================\n');
  
  // Check if sharp is available
  let sharp;
  try {
    sharp = require('sharp');
  } catch (error) {
    console.error('❌ Error: sharp module not found.');
    console.log('Please install it by running: npm install sharp');
    process.exit(1);
  }
  
  const sourceImage = path.join(__dirname, '../public/media/logos/tradeworks-logo.png');
  const publicDir = path.join(__dirname, '../public');
  
  // Check if source image exists
  if (!fs.existsSync(sourceImage)) {
    console.error(`❌ Error: Source image not found at ${sourceImage}`);
    console.log('\nPlease ensure you have a logo at: public/media/logos/tradeworks-logo.png');
    
    // Create a placeholder configuration file instead
    console.log('\n📝 Creating icon configuration file for manual setup...');
    
    const iconConfig = {
      generated: new Date().toISOString(),
      sourceImage: '/media/logos/tradeworks-logo.png',
      icons: {
        pwa: iconSizes.pwa.map(icon => ({
          size: `${icon.size}x${icon.size}`,
          path: `/icons/${icon.name}`
        })),
        ios: iconSizes.ios.map(icon => ({
          size: `${icon.size}x${icon.size}`,
          path: `/icons/ios/${icon.name}`
        })),
        android: iconSizes.android.map(icon => ({
          size: `${icon.size}x${icon.size}`,
          path: `/icons/android/${icon.folder}/${icon.name}`
        }))
      }
    };
    
    // Create icons directory
    const iconsDir = path.join(publicDir, 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }
    
    // Write configuration
    fs.writeFileSync(
      path.join(iconsDir, 'icon-config.json'),
      JSON.stringify(iconConfig, null, 2)
    );
    
    console.log('✅ Created icon configuration at: public/icons/icon-config.json');
    console.log('\n📌 Next steps:');
    console.log('1. Add your logo image to: public/media/logos/tradeworks-logo.png');
    console.log('2. Run: npm install sharp');
    console.log('3. Run this script again: node scripts/generate-app-icons.js');
    
    return;
  }
  
  console.log(`📸 Using source image: ${sourceImage}`);
  
  // Create icons directories
  const iconsDir = path.join(publicDir, 'icons');
  const iosDir = path.join(iconsDir, 'ios');
  const androidDir = path.join(iconsDir, 'android');
  const splashDir = path.join(publicDir, 'splash-screens');
  
  [iconsDir, iosDir, androidDir, splashDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Generate icons
  try {
    // PWA Icons
    console.log('\n📱 Generating PWA icons...');
    for (const icon of iconSizes.pwa) {
      await sharp(sourceImage)
        .resize(icon.size, icon.size)
        .toFile(path.join(iconsDir, icon.name));
      console.log(`  ✅ ${icon.name}`);
    }
    
    // iOS Icons
    console.log('\n🍎 Generating iOS icons...');
    for (const icon of iconSizes.ios) {
      const size = Math.round(icon.size);
      await sharp(sourceImage)
        .resize(size, size)
        .toFile(path.join(iosDir, icon.name));
      console.log(`  ✅ ${icon.name}`);
    }
    
    // Android Icons
    console.log('\n🤖 Generating Android icons...');
    for (const icon of iconSizes.android) {
      const folder = path.join(androidDir, icon.folder);
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
      await sharp(sourceImage)
        .resize(icon.size, icon.size)
        .toFile(path.join(folder, 'ic_launcher.png'));
      console.log(`  ✅ ${icon.folder}/ic_launcher.png`);
    }
    
    // Favicon
    console.log('\n🌐 Generating favicon variants...');
    for (const icon of iconSizes.favicon) {
      await sharp(sourceImage)
        .resize(icon.size, icon.size)
        .toFile(path.join(iconsDir, icon.name));
      console.log(`  ✅ ${icon.name}`);
    }
    
    // Apple Touch Icon
    console.log('\n🍏 Generating Apple touch icon...');
    for (const icon of iconSizes.apple) {
      await sharp(sourceImage)
        .resize(icon.size, icon.size)
        .toFile(path.join(iconsDir, icon.name));
      console.log(`  ✅ ${icon.name}`);
    }
    
    // Generate basic splash screens
    console.log('\n🎨 Generating splash screens...');
    const splashSizes = [
      { width: 640, height: 1136, name: 'launch-640x1136.png' },
      { width: 750, height: 1334, name: 'launch-750x1334.png' },
      { width: 1242, height: 2208, name: 'launch-1242x2208.png' },
      { width: 828, height: 1792, name: 'launch-828x1792.png' },
      { width: 1125, height: 2436, name: 'launch-1125x2436.png' },
      { width: 1242, height: 2688, name: 'launch-1242x2688.png' },
      { width: 1284, height: 2778, name: 'launch-1284x2778.png' }
    ];
    
    for (const splash of splashSizes) {
      // Create a splash screen with centered logo
      const logoSize = Math.min(splash.width, splash.height) * 0.3;
      
      await sharp({
        create: {
          width: splash.width,
          height: splash.height,
          channels: 4,
          background: { r: 59, g: 130, b: 246, alpha: 1 } // #3b82f6
        }
      })
      .composite([{
        input: await sharp(sourceImage)
          .resize(Math.round(logoSize), Math.round(logoSize))
          .toBuffer(),
        gravity: 'center'
      }])
      .toFile(path.join(splashDir, splash.name));
      
      console.log(`  ✅ ${splash.name}`);
    }
    
    console.log('\n✨ Icon generation complete!');
    console.log('\n📌 Next steps:');
    console.log('1. Icons are ready in: public/icons/');
    console.log('2. Update manifest.json with the generated icon paths');
    console.log('3. For iOS: Copy icons to ios/App/App/Assets.xcassets/');
    console.log('4. For Android: Icons are already in the correct structure');
    
  } catch (error) {
    console.error('\n❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

// Run the generator
generateIcons();