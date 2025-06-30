@echo off
echo Deploying SIP endpoint creation and outbound call fixes...
echo.

cd /d "%~dp0"

echo Current directory: %CD%
echo.

echo 1. Deploying create-sip-endpoint function...
supabase functions deploy create-sip-endpoint

echo.
echo 2. Deploying updated start-outbound-call function...
supabase functions deploy start-outbound-call

echo.
echo 3. Deploying generate-signalwire-voice-token function...
supabase functions deploy generate-signalwire-voice-token

echo.
echo ========================================
echo DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo What these functions now do:
echo.
echo 1. create-sip-endpoint:
echo    - Creates SIP endpoint if it doesn't exist
echo    - Adds SIP users to existing endpoint
echo    - Stores credentials in database
echo.
echo 2. start-outbound-call:
echo    - Uses EXISTING phone numbers from tenant_phone_numbers table
echo    - No longer tries to auto-provision new numbers
echo    - Calls create-sip-endpoint if needed
echo.
echo 3. generate-signalwire-voice-token:
echo    - Generates session-based tokens
echo    - Creates SIP users if needed
echo.
echo Next steps:
echo 1. Test the phone dialer - should work with existing numbers
echo 2. Manual SIP user creation may still be needed in SignalWire dashboard
echo 3. Check that your tenant_phone_numbers table has active numbers

pause