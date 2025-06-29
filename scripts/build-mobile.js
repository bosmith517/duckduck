#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BUILD_CONFIG = {
  platforms: ['ios', 'android'],
  buildType: process.argv[2] || 'development', // development, staging, production
  skipTests: process.argv.includes('--skip-tests'),
  skipSync: process.argv.includes('--skip-sync'),
  openNative: process.argv.includes('--open'),
};

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function execCommand(command, options = {}) {
  try {
    logStep('EXEC', command);
    const result = execSync(command, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      ...options 
    });
    return result;
  } catch (error) {
    logError(`Command failed: ${command}`);
    throw error;
  }
}

function checkPrerequisites() {
  logStep('CHECK', 'Verifying prerequisites...');
  
  // Check if Capacitor is installed
  try {
    execCommand('npx cap --version', { stdio: 'pipe' });
    logSuccess('Capacitor CLI is available');
  } catch (error) {
    logError('Capacitor CLI not found. Please install with: npm install -g @capacitor/cli');
    process.exit(1);
  }

  // Check if Node.js version is compatible
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    logError(`Node.js ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
    process.exit(1);
  }
  
  logSuccess(`Node.js ${nodeVersion} is compatible`);

  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    logError('package.json not found. Please run this script from the project root.');
    process.exit(1);
  }

  // Check if capacitor.config.ts exists
  if (!fs.existsSync('capacitor.config.ts')) {
    logError('capacitor.config.ts not found. Please initialize Capacitor first.');
    process.exit(1);
  }

  logSuccess('All prerequisites met');
}

function updateEnvironmentConfig() {
  logStep('CONFIG', `Setting up environment for ${BUILD_CONFIG.buildType}`);
  
  // Create environment-specific config
  const envConfig = {
    development: {
      API_URL: 'http://localhost:5173',
      DEBUG: true,
      ANALYTICS_ENABLED: false,
    },
    staging: {
      API_URL: 'https://staging-api.tradeworkspro.com',
      DEBUG: true,
      ANALYTICS_ENABLED: true,
    },
    production: {
      API_URL: 'https://api.tradeworkspro.com',
      DEBUG: false,
      ANALYTICS_ENABLED: true,
    },
  };

  const config = envConfig[BUILD_CONFIG.buildType];
  if (!config) {
    logError(`Invalid build type: ${BUILD_CONFIG.buildType}`);
    process.exit(1);
  }

  // Write environment config to a file that the app can read
  const configPath = path.join(__dirname, '..', 'src', 'config', 'mobile-build.json');
  const configDir = path.dirname(configPath);
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  logSuccess(`Environment configuration written to ${configPath}`);
}

function runTests() {
  if (BUILD_CONFIG.skipTests) {
    logWarning('Skipping tests as requested');
    return;
  }

  logStep('TEST', 'Running tests...');
  
  try {
    // Run TypeScript compilation check
    execCommand('npm run build:check');
    logSuccess('TypeScript compilation check passed');

    // Run linting
    execCommand('npm run lint');
    logSuccess('Linting passed');

    // Run unit tests if available
    if (fs.existsSync('src/__tests__')) {
      execCommand('npm test -- --watchAll=false');
      logSuccess('Unit tests passed');
    }

  } catch (error) {
    logError('Tests failed. Use --skip-tests to bypass.');
    process.exit(1);
  }
}

function buildWebApp() {
  logStep('BUILD', 'Building web application...');
  
  try {
    // Clean previous build
    if (fs.existsSync('dist')) {
      execCommand('rm -rf dist');
    }

    // Build the web app
    execCommand('npm run build');
    logSuccess('Web application built successfully');

    // Verify build output
    if (!fs.existsSync('dist/index.html')) {
      logError('Build output is missing. Please check the build process.');
      process.exit(1);
    }

  } catch (error) {
    logError('Web build failed');
    process.exit(1);
  }
}

function syncCapacitor() {
  if (BUILD_CONFIG.skipSync) {
    logWarning('Skipping Capacitor sync as requested');
    return;
  }

  logStep('SYNC', 'Syncing Capacitor...');
  
  try {
    execCommand('npx cap sync');
    logSuccess('Capacitor sync completed');
  } catch (error) {
    logError('Capacitor sync failed');
    process.exit(1);
  }
}

function buildPlatforms() {
  logStep('PLATFORMS', `Building for platforms: ${BUILD_CONFIG.platforms.join(', ')}`);
  
  BUILD_CONFIG.platforms.forEach(platform => {
    buildPlatform(platform);
  });
}

function buildPlatform(platform) {
  logStep('PLATFORM', `Building ${platform} platform...`);
  
  try {
    switch (platform) {
      case 'ios':
        buildiOS();
        break;
      case 'android':
        buildAndroid();
        break;
      default:
        logError(`Unsupported platform: ${platform}`);
        process.exit(1);
    }
  } catch (error) {
    logError(`Failed to build ${platform} platform`);
    process.exit(1);
  }
}

function buildiOS() {
  logStep('iOS', 'Building iOS application...');
  
  // Check if iOS platform exists
  if (!fs.existsSync('ios')) {
    logWarning('iOS platform not found. Run: npx cap add ios');
    return;
  }

  // Check if Xcode is available (macOS only)
  if (process.platform !== 'darwin') {
    logWarning('iOS build requires macOS with Xcode installed');
    return;
  }

  try {
    // Update iOS project
    execCommand('npx cap update ios');
    
    if (BUILD_CONFIG.buildType === 'production') {
      // Build for production (requires proper code signing)
      logStep('iOS', 'Building for production...');
      execCommand('npx cap build ios --prod');
    } else {
      // Open in Xcode for development
      if (BUILD_CONFIG.openNative) {
        execCommand('npx cap open ios');
      }
    }
    
    logSuccess('iOS build completed');
  } catch (error) {
    logError('iOS build failed');
    throw error;
  }
}

function buildAndroid() {
  logStep('ANDROID', 'Building Android application...');
  
  // Check if Android platform exists
  if (!fs.existsSync('android')) {
    logWarning('Android platform not found. Run: npx cap add android');
    return;
  }

  try {
    // Update Android project
    execCommand('npx cap update android');
    
    if (BUILD_CONFIG.buildType === 'production') {
      // Build production APK/AAB
      logStep('ANDROID', 'Building production APK...');
      execCommand('cd android && ./gradlew assembleRelease');
      
      // Build App Bundle for Play Store
      execCommand('cd android && ./gradlew bundleRelease');
      
      logSuccess('Android production builds completed');
      logSuccess('APK: android/app/build/outputs/apk/release/app-release.apk');
      logSuccess('AAB: android/app/build/outputs/bundle/release/app-release.aab');
      
    } else {
      // Build debug APK
      execCommand('cd android && ./gradlew assembleDebug');
      
      if (BUILD_CONFIG.openNative) {
        execCommand('npx cap open android');
      }
      
      logSuccess('Android debug build completed');
      logSuccess('APK: android/app/build/outputs/apk/debug/app-debug.apk');
    }
    
  } catch (error) {
    logError('Android build failed');
    throw error;
  }
}

function generateBuildReport() {
  logStep('REPORT', 'Generating build report...');
  
  const buildReport = {
    timestamp: new Date().toISOString(),
    buildType: BUILD_CONFIG.buildType,
    platforms: BUILD_CONFIG.platforms,
    nodeVersion: process.version,
    gitCommit: execCommand('git rev-parse HEAD', { stdio: 'pipe' }).trim(),
    gitBranch: execCommand('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' }).trim(),
    buildOutputs: [],
  };

  // Check for build outputs
  if (fs.existsSync('android/app/build/outputs/apk/release/app-release.apk')) {
    buildReport.buildOutputs.push('android/app/build/outputs/apk/release/app-release.apk');
  }
  
  if (fs.existsSync('android/app/build/outputs/apk/debug/app-debug.apk')) {
    buildReport.buildOutputs.push('android/app/build/outputs/apk/debug/app-debug.apk');
  }
  
  if (fs.existsSync('android/app/build/outputs/bundle/release/app-release.aab')) {
    buildReport.buildOutputs.push('android/app/build/outputs/bundle/release/app-release.aab');
  }

  // Write build report
  const reportPath = path.join(__dirname, '..', 'build-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(buildReport, null, 2));
  
  logSuccess(`Build report generated: ${reportPath}`);
  return buildReport;
}

function main() {
  log('🚀 TradeWorks Pro Mobile Build Script', 'magenta');
  log(`Build Type: ${BUILD_CONFIG.buildType}`, 'blue');
  log(`Platforms: ${BUILD_CONFIG.platforms.join(', ')}`, 'blue');
  log('', 'reset');

  try {
    checkPrerequisites();
    updateEnvironmentConfig();
    runTests();
    buildWebApp();
    syncCapacitor();
    buildPlatforms();
    
    const buildReport = generateBuildReport();
    
    log('', 'reset');
    log('🎉 Mobile build completed successfully!', 'green');
    
    if (buildReport.buildOutputs.length > 0) {
      log('📦 Build outputs:', 'cyan');
      buildReport.buildOutputs.forEach(output => {
        log(`   • ${output}`, 'blue');
      });
    }
    
    log('', 'reset');
    log('Next Steps:', 'yellow');
    
    if (BUILD_CONFIG.buildType === 'production') {
      log('• Test the built apps on physical devices', 'yellow');
      log('• Upload to App Store Connect (iOS) or Play Console (Android)', 'yellow');
      log('• Submit for review', 'yellow');
    } else {
      log('• Test the built apps on physical devices or emulators', 'yellow');
      log('• Use --open flag to open in native IDEs', 'yellow');
    }
    
  } catch (error) {
    log('', 'reset');
    logError('Build failed!');
    console.error(error);
    process.exit(1);
  }
}

// Handle script arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
TradeWorks Pro Mobile Build Script

Usage: node scripts/build-mobile.js [build-type] [options]

Build Types:
  development  - Development build with debugging enabled
  staging      - Staging build for testing
  production   - Production build for app stores

Options:
  --skip-tests    Skip running tests
  --skip-sync     Skip Capacitor sync
  --open          Open in native IDE after build
  --help, -h      Show this help message

Examples:
  node scripts/build-mobile.js development --open
  node scripts/build-mobile.js production --skip-tests
  node scripts/build-mobile.js staging
`);
  process.exit(0);
}

// Run the main function
main();