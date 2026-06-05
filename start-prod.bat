@echo off
color 0A
echo ====================================================
echo    Spotify Toolkit - Secure PRODUCTION Launcher
echo ====================================================
echo.
echo Building the optimized production application...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Build failed! Production server will not start.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Launching Node script...
node scripts/prod-tunnel.mjs
pause
