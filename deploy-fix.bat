@echo off
echo Deploying fixed SignalWire Edge Function...
echo.

cd /d "%~dp0"

echo Current directory: %CD%
echo.

echo Deploying generate-signalwire-voice-token function...
supabase functions deploy generate-signalwire-voice-token

echo.
echo Deployment complete!
echo.
echo Next steps:
echo 1. Check Supabase Dashboard for deployment status
echo 2. Test the phone dialer - should work without the 'notes' column error
echo 3. The function will create SIP configs without the notes field

pause