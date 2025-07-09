#!/bin/bash

echo "Installing capacitor-native-settings plugin..."
npm install capacitor-native-settings

echo "Syncing Capacitor plugins..."
npx cap sync

echo "Installation complete!"
echo ""
echo "Note: Make sure to rebuild your app after this installation."
echo "For iOS: npm run cap:run:ios"
echo "For Android: npm run cap:run:android"