@echo off
echo ========================================
echo Starting TradeWorks Pro in DEVELOPMENT MODE
echo ========================================
echo.
echo Clearing any old builds and caches...
if exist dist rmdir /s /q dist
if exist node_modules\.vite rmdir /s /q node_modules\.vite
echo.
echo Starting Vite development server...
echo This will show live changes as you edit files
echo.
npm run dev